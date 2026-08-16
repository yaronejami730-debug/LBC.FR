/**
 * Les huit scénarios anti-spam, joués contre la vraie base.
 *
 * Un compte jetable est créé, mené à travers chaque situation, puis supprimé.
 * Les règles testées ici décident d'envoyer ou non un email à quelqu'un : les
 * vérifier sur des objets fabriqués en mémoire ne prouverait pas grand-chose,
 * puisque c'est justement la base qui porte la garantie anti-doublon.
 *
 *     npx tsx -r ./scripts/load-env.ts scripts/test-satisfaction.ts
 */

import { prisma } from "../lib/prisma";
import { isUserEligibleForSatisfaction, openCampaign } from "../lib/satisfaction/engine";
import { SATISFACTION_CONFIG } from "../lib/satisfaction/config";
import { createSatisfactionToken, verifySatisfactionToken } from "../lib/satisfaction/token";

const DAY = 86_400_000;
const HOUR = 3_600_000;
let ok = 0, ko = 0;

function check(label: string, cond: boolean, detail = "") {
  if (cond) { ok++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`); }
  else { ko++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`); }
}

const MARK = "__SATISFACTION_TEST__";

async function makeUser(ageDays = 200) {
  return prisma.user.create({
    data: {
      email: `${MARK}-${Date.now()}-${Math.random().toString(36).slice(2)}@dealandco.local`,
      password: "x", name: `${MARK} Testeur`, role: "USER", emailVerified: true,
      createdAt: new Date(Date.now() - ageDays * DAY),
    },
    select: { id: true },
  });
}

async function addListings(userId: string, n: number, spreadMinutes = 10) {
  for (let i = 0; i < n; i++) {
    await prisma.listing.create({
      data: {
        userId, title: `${MARK} annonce ${i + 1}`, description: "test", price: 10,
        category: "Maison", location: "Paris", status: "APPROVED",
        createdAt: new Date(Date.now() - (n - i) * spreadMinutes * 60_000),
      },
    });
  }
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { name: { contains: MARK } }, select: { id: true },
  });
  for (const u of users) {
    await prisma.listing.deleteMany({ where: { userId: u.id } });
    await prisma.satisfactionCampaign.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
  }
}

async function main() {
  await cleanup();
  console.log(`\nseuil ${SATISFACTION_CONFIG.activityThreshold} annonces · fenêtre ` +
    `${SATISFACTION_CONFIG.burstWindowHours} h · silence ${SATISFACTION_CONFIG.cooldownDays} j\n`);

  // ── TEST 1 — 3 annonces en 10 minutes → une seule campagne ─────────────
  {
    const u = await makeUser();
    await addListings(u.id, 3, 3);
    const first = await openCampaign(u.id, "ACTIVITY");
    const second = await openCampaign(u.id, "ACTIVITY");
    check("1. 3 annonces en 10 min → 1 seule sollicitation",
      first.created && !second.created,
      second.created ? "DEUX créées" : `2e refusée : ${!second.created && second.reason}`);
  }

  // ── TEST 2 — 4 annonces en 2 heures → toujours une seule ───────────────
  {
    const u = await makeUser();
    await addListings(u.id, 4, 30);
    await openCampaign(u.id, "ACTIVITY");
    const again = await openCampaign(u.id, "ACTIVITY");
    check("2. 4 annonces en 2 h → pas de seconde sollicitation", !again.created,
      !again.created ? again.reason : "");
  }

  // ── TEST 3 — nouvelle salve le lendemain → le silence tient ────────────
  {
    const u = await makeUser();
    await addListings(u.id, 3);
    const c = await openCampaign(u.id, "ACTIVITY");
    if (c.created) {
      await prisma.satisfactionCampaign.update({
        where: { id: c.campaignId }, data: { status: "SENT", sentAt: new Date() },
      });
    }
    await addListings(u.id, 3);
    const tomorrow = new Date(Date.now() + 1 * DAY);
    const next = await openCampaign(u.id, "ACTIVITY", tomorrow);
    check("3. nouvelle salve le lendemain → rien", !next.created,
      !next.created ? next.reason : "");
  }

  // ── TEST 4 — périodique envoyée, puis 4 annonces → rien ────────────────
  {
    const u = await makeUser();
    const c = await openCampaign(u.id, "PERIODIC");
    if (c.created) {
      await prisma.satisfactionCampaign.update({
        where: { id: c.campaignId }, data: { status: "SENT", sentAt: new Date() },
      });
    }
    await addListings(u.id, 4);
    const act = await openCampaign(u.id, "ACTIVITY", new Date(Date.now() + 1 * DAY));
    check("4. périodique reçue, puis activité → aucun second email", !act.created,
      !act.created ? act.reason : "");
  }

  // ── TEST 5 — plus de 5 mois sans rien → éligible au périodique ─────────
  {
    const u = await makeUser(200);
    const e = await isUserEligibleForSatisfaction(u.id, "PERIODIC");
    check("5. compte de 200 jours jamais sollicité → éligible", e.eligible,
      e.eligible ? "" : e.reason);
  }

  // ── TEST 6 — désabonné → rien, quel que soit le motif ──────────────────
  {
    const u = await makeUser();
    await prisma.user.update({
      where: { id: u.id },
      data: { notificationPreferences: { personalized: { email: false } } },
    });
    await addListings(u.id, 5);
    const a = await isUserEligibleForSatisfaction(u.id, "ACTIVITY");
    const p = await isUserEligibleForSatisfaction(u.id, "PERIODIC");
    check("6. désabonné → aucun email, activité comme périodique",
      !a.eligible && !p.eligible,
      `${!a.eligible && a.reason} / ${!p.eligible && p.reason}`);
  }

  // ── TEST 7 — deux exécutions simultanées → une seule campagne ──────────
  {
    const u = await makeUser();
    await addListings(u.id, 4);
    // Lancées en parallèle : c'est l'index unique partiel qui doit trancher,
    // pas l'ordre d'exécution.
    const [a, b] = await Promise.all([
      openCampaign(u.id, "ACTIVITY"),
      openCampaign(u.id, "ACTIVITY"),
    ]);
    const n = await prisma.satisfactionCampaign.count({ where: { userId: u.id } });
    check("7. deux crons simultanés → une seule campagne en base", n === 1,
      `${n} campagne(s), créées : ${[a.created, b.created].filter(Boolean).length}`);
  }

  // ── TEST 8 — un échec ne bloque pas définitivement ─────────────────────
  {
    const u = await makeUser();
    await addListings(u.id, 3);
    const c = await openCampaign(u.id, "ACTIVITY");
    if (c.created) {
      await prisma.satisfactionCampaign.update({
        where: { id: c.campaignId },
        data: { status: "FAILED", reason: "test", attempts: 3 },
      });
    }
    // FAILED ne compte pas parmi les états ouverts : le compte peut redevenir
    // éligible plus tard sans rester prisonnier d'une campagne morte.
    const retry = await openCampaign(u.id, "ACTIVITY");
    const n = await prisma.satisfactionCampaign.count({ where: { userId: u.id } });
    check("8. après échec définitif → une nouvelle campagne reste possible",
      retry.created && n === 2, `${n} campagne(s)`);
  }

  // ── Seuil non atteint ──────────────────────────────────────────────────
  {
    const u = await makeUser();
    await addListings(u.id, 2);
    const e = await isUserEligibleForSatisfaction(u.id, "ACTIVITY");
    check("2 annonces seulement → sous le seuil", !e.eligible,
      !e.eligible ? e.reason : "");
  }

  // ── Compte trop récent ─────────────────────────────────────────────────
  {
    const u = await makeUser(3);
    await addListings(u.id, 5);
    const e = await isUserEligibleForSatisfaction(u.id, "ACTIVITY");
    check("compte de 3 jours → trop récent pour qu'on lui demande", !e.eligible,
      !e.eligible ? e.reason : "");
  }

  // ── Jetons ─────────────────────────────────────────────────────────────
  console.log("\nLIEN DU QUESTIONNAIRE");
  {
    const token = createSatisfactionToken("camp_123");
    check("un jeton valide se relit", verifySatisfactionToken(token)?.campaignId === "camp_123");
    check("un jeton trafiqué est refusé", verifySatisfactionToken(token.slice(0, -3) + "aaa") === null);
    check("le jeton ne porte aucune adresse ni identifiant de compte",
      !token.toLowerCase().includes("dealandco"));
  }

  await cleanup();
  console.log(`\n${ok} réussis, ${ko} échoués\n`);
  if (ko > 0) process.exitCode = 1;
}

main()
  .catch(async (err) => { console.error(err); await cleanup(); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

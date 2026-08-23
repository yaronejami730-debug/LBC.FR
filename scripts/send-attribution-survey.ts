/**
 * Envoi du sondage « Comment nous avez-vous connus ? ».
 *
 *   npm run survey:attribution                          → simulation, rien n'part
 *   npm run survey:attribution -- --test=moi@exemple.fr  → un seul envoi, à soi
 *   npm run survey:attribution -- --send                 → envoi réel
 *   npm run survey:attribution -- --send --audience=verified
 *   npm run survey:attribution -- --report               → résultats agrégés
 *
 * ── Ce que ce script refuse de faire ──────────────────────────────────────
 *
 * Il n'envoie rien sans `--send`. Un envoi massif ne se rejoue pas : une fois
 * parti, le message est parti. La simulation affiche donc exactement qui serait
 * destinataire, combien ils sont, et le premier message tel qu'il sera reçu.
 *
 * ── Les audiences, et ce qu'elles engagent ────────────────────────────────
 *
 *   consent  — comptes ayant accepté les communications (`marketingConsent`).
 *              Le choix juridiquement le plus sûr, et le plus petit.
 *   verified — comptes actifs à l'adresse vérifiée. Un sondage d'amélioration
 *              du service relève de la relation client, pas de la prospection,
 *              mais c'est un arbitrage qui appartient à l'exploitant, pas à ce
 *              script. Chaque message porte un lien de désinscription.
 *
 * Sont exclus dans tous les cas : comptes bannis, adresses non vérifiées pour
 * `verified`, et toute personne ayant déjà répondu — on ne redemande pas.
 */
import { prisma } from "../lib/prisma";
import { sendEmail } from "../lib/email";
import { createEmailPrefToken } from "../lib/email-token";
import { attributionSurveyEmail } from "../lib/emails/attribution-survey";
import { ATTRIBUTION_KIND, attributionReport } from "../lib/attribution";

/**
 * Adresse mise dans les liens du message.
 *
 * `NEXT_PUBLIC_APP_URL` vaut `http://localhost:3000` sur un poste de
 * développement — et le premier essai est parti avec des liens vers localhost,
 * inexploitables dans une vraie boîte mail. Une adresse locale est donc
 * ignorée : un e-mail quitte la machine, ses liens doivent pouvoir y revenir.
 * `--base=` reste disponible pour viser un environnement de test.
 */
const ENV_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "";
const BASE = (
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ??
  (ENV_BASE.startsWith("https://") ? ENV_BASE : "https://www.dealandcompany.fr")
).replace(/\/$/, "");

const flag = (name: string) =>
  process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
const has = (name: string) => process.argv.some((a) => a === `--${name}` || a.startsWith(`--${name}=`));

const SEND = has("send");
const TEST_TO = flag("test");
const AUDIENCE = (flag("audience") ?? "consent") as "consent" | "verified";
const LIMIT = Number(flag("limit") ?? 0);

/** Une seconde entre deux messages : aucun fournisseur ne reproche cette allure. */
const DELAY_MS = 1000;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function surveyUrl(userId: string): string {
  // 90 jours : le temps qu'un e-mail soit ouvert tard, sans rester valable
  // indéfiniment. Le jeton ne donne accès qu'à cette question.
  return `${BASE}/sondage?t=${createEmailPrefToken(userId, 90)}`;
}

async function audience() {
  // Les personnes ayant déjà répondu sortent de la liste : redemander à
  // quelqu'un qui a pris le temps de répondre est le meilleur moyen de ne plus
  // jamais obtenir de réponse.
  const answered = await prisma.userEvent.findMany({
    where: { kind: ATTRIBUTION_KIND, userId: { not: null } },
    select: { userId: true },
    distinct: ["userId"],
  });
  const done = new Set(answered.map((a) => a.userId!));

  const users = await prisma.user.findMany({
    where: {
      bannedAt: null,
      ...(AUDIENCE === "consent"
        ? { marketingConsent: true, emailVerified: true }
        : { emailVerified: true }),
    },
    select: { id: true, name: true, email: true },
    orderBy: { createdAt: "asc" },
  });

  const list = users.filter((u) => !done.has(u.id) && u.email);
  return LIMIT > 0 ? list.slice(0, LIMIT) : list;
}

async function report() {
  const invited = await prisma.userEvent.count({ where: { kind: `${ATTRIBUTION_KIND}_SENT` } });
  const r = await attributionReport(invited || undefined);

  console.log(`\nRéponses : ${r.answers}${r.responseRate !== null ? ` sur ${r.invited} sollicités (${r.responseRate.toFixed(0)} %)` : ""}\n`);
  for (const row of r.rows) {
    const bar = "█".repeat(Math.round(row.share / 4));
    console.log(`  ${row.label.padEnd(42)} ${String(row.count).padStart(4)}  ${row.share.toFixed(0).padStart(3)} % ${bar}`);
  }
  if (r.freeText.length > 0) {
    console.log("\n  « Autrement » — ce qui a été écrit :");
    for (const f of r.freeText.slice(0, 15)) console.log(`    · ${f.detail}`);
  }
}

async function main() {
  if (has("report")) return report();

  if (TEST_TO) {
    // L'essai part sur un compte réel : c'est le seul moyen de voir le message
    // tel qu'il sera reçu, jeton et lien de réponse compris.
    const user = await prisma.user.findFirst({
      where: { email: TEST_TO },
      select: { id: true, name: true, email: true },
    });
    if (!user) {
      console.error(`Aucun compte avec l'adresse ${TEST_TO}. L'essai a besoin d'un compte réel pour signer un lien valide.`);
      process.exitCode = 1;
      return;
    }
    await sendEmail({
      to: user.email,
      toName: user.name ?? undefined,
      subject: "Comment nous avez-vous connus ?",
      html: attributionSurveyEmail({ name: user.name ?? "à vous", surveyUrl: surveyUrl(user.id) }),
      adSource: "attribution-survey",
      userId: user.id,
    });
    console.log(`Essai envoyé à ${user.email}.`);
    console.log(`Lien de réponse : ${surveyUrl(user.id)}`);
    return;
  }

  const list = await audience();
  console.log(`\naudience « ${AUDIENCE} » : ${list.length} destinataire(s)`);
  console.log(list.slice(0, 5).map((u) => `  · ${u.email}`).join("\n"));
  if (list.length > 5) console.log(`  … et ${list.length - 5} autres`);

  if (!SEND) {
    console.log("\nSimulation : aucun message n'a été envoyé. Ajoutez --send pour l'envoi réel.");
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const u of list) {
    try {
      await sendEmail({
        to: u.email,
        toName: u.name ?? undefined,
        subject: "Comment nous avez-vous connus ?",
        html: attributionSurveyEmail({ name: u.name ?? "à vous", surveyUrl: surveyUrl(u.id) }),
        adSource: "attribution-survey",
        userId: u.id,
      });
      // Trace de sollicitation : c'est elle qui donne un dénominateur au taux
      // de réponse. Sans elle, on saurait qui a répondu sans savoir à qui on a
      // demandé.
      await prisma.userEvent.create({
        data: { userId: u.id, kind: `${ATTRIBUTION_KIND}_SENT`, path: "/sondage" },
      });
      sent++;
    } catch (e) {
      failed++;
      console.error(`  échec ${u.email} : ${(e as Error).message}`);
    }
    await wait(DELAY_MS);
  }

  console.log(`\n${sent} envoyé(s), ${failed} en échec.`);
}

main().finally(() => prisma.$disconnect());

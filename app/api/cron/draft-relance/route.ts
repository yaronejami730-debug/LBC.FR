/**
 * Cron — brouillons de dépôt abandonnés : deux relances, puis purge.
 *
 * Le formulaire de dépôt s'enregistre tout seul (`/api/drafts`). Un vendeur
 * qui ferme l'onglet au milieu ne perd donc rien — mais il ne le sait pas, et
 * c'est là que l'annonce meurt. Ce cron dit ce qui a été gardé, une fois, puis
 * rappelle une dernière fois, puis se tait.
 *
 * Rythme, par brouillon :
 *   1re relance  — 1 h 30 après le dernier geste sur le formulaire
 *   2e relance   — 4 h après la première, seulement si rien n'a bougé depuis
 *   suppression  — 30 jours après le dernier geste
 *
 * Après la seconde relance, plus aucun email n'est envoyé pour ce brouillon :
 * les deux horodatages restent posés jusqu'à la publication (qui supprime le
 * brouillon) ou la purge. Le cycle ne se réarme donc que sur un brouillon neuf.
 *
 * Garde-fous : `CRON_SECRET` Bearer, lot plafonné, comptes bannis/restreints
 * écartés, préférence email `personalized` respectée, et vérification qu'aucune
 * annonce n'a été publiée entre-temps — annoncer « vous n'avez pas terminé » à
 * quelqu'un qui vient de publier est la seule erreur vraiment coûteuse ici.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { isEmailAllowed } from "@/lib/notifications/preferences";
import { draftSavedEmail, draftReminderEmail } from "@/lib/emails/draft-relance";
import { CATEGORIES } from "@/lib/categories";
import {
  DRAFT_KEEP_DAYS,
  DRAFT_RELANCE_1_AFTER_MS,
  DRAFT_RELANCE_2_AFTER_MS,
} from "@/lib/drafts";

const DAY_MS = 86_400_000;

/** Plafond par exécution — le cron tourne toutes les 30 min, il rattrapera. */
const MAX_PER_RUN = 200;

const BASE_URL = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
const CTA_URL = `${BASE_URL}/post`;

type DraftRow = {
  id: string;
  userId: string;
  payload: string;
  category: string | null;
  updatedAt: Date;
};

/** Titre saisi par le vendeur, s'il en avait déjà mis un. */
function readTitle(payload: string): string | null {
  try {
    const parsed = JSON.parse(payload) as { title?: unknown };
    const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
    return title.length > 0 ? title.slice(0, 120) : null;
  } catch {
    return null;
  }
}

function categoryLabel(id: string | null): string | null {
  if (!id) return null;
  return CATEGORIES.find((c) => c.id === id)?.label ?? null;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Filtre commun aux deux relances.
 *
 * Renvoie le destinataire, ou `null` avec le motif du rejet. Un brouillon dont
 * l'annonce est déjà publiée est supprimé au passage : le `DELETE` côté
 * formulaire a pu échouer (onglet fermé pendant la requête), et le laisser en
 * base ferait revenir le même candidat à chaque exécution.
 */
async function resolveRecipient(
  draft: DraftRow,
): Promise<{ email: string; name: string } | { skip: string }> {
  const user = await prisma.user.findUnique({
    where: { id: draft.userId },
    select: { email: true, name: true, bannedAt: true, restrictedAt: true },
  });
  if (!user) return { skip: "compte_absent" };
  if (user.bannedAt || user.restrictedAt) return { skip: "compte_bloque" };

  const publishedSince = await prisma.listing.count({
    where: { userId: draft.userId, createdAt: { gte: draft.updatedAt } },
  });
  if (publishedSince > 0) {
    await prisma.draft.delete({ where: { id: draft.id } }).catch(() => {});
    return { skip: "deja_publie" };
  }

  if (!(await isEmailAllowed(draft.userId, "personalized"))) {
    return { skip: "preference_email" };
  }

  return { email: user.email, name: user.name };
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const skipReasons: Record<string, number> = {};
  const noteSkip = (reason: string) => {
    skipReasons[reason] = (skipReasons[reason] ?? 0) + 1;
  };

  // ── Purge des brouillons dormants ────────────────────────────────────────
  // Annoncée dans les deux emails : 30 jours après le dernier geste, la place
  // est rendue. Passe en premier pour ne jamais relancer un brouillon qui
  // serait supprimé dans la foulée.
  const purged = await prisma.draft.deleteMany({
    where: { updatedAt: { lt: new Date(now - DRAFT_KEEP_DAYS * DAY_MS) } },
  });

  const select = { id: true, userId: true, payload: true, category: true, updatedAt: true } as const;

  // ── 1re relance : « c'est enregistré en brouillon » ──────────────────────
  const firstCandidates = await prisma.draft.findMany({
    where: {
      nudge1SentAt: null,
      completeness: { gt: 0 },
      updatedAt: { lte: new Date(now - DRAFT_RELANCE_1_AFTER_MS) },
    },
    select,
    orderBy: { updatedAt: "asc" },
    take: MAX_PER_RUN,
  });

  let sent1 = 0;
  for (const draft of firstCandidates) {
    const who = await resolveRecipient(draft);
    if ("skip" in who) {
      noteSkip(who.skip);
      continue;
    }

    await sendEmail({
      to: who.email,
      toName: who.name,
      subject: "Votre annonce est enregistrée en brouillon",
      html: draftSavedEmail({
        name: who.name,
        title: readTitle(draft.payload),
        category: categoryLabel(draft.category),
        ctaUrl: CTA_URL,
        keepDays: DRAFT_KEEP_DAYS,
      }),
      adSource: "draft_relance_1",
      userId: draft.userId,
    }).catch((err) => console.error("[draft-relance] 1re relance échec:", err));

    // Posé même si l'envoi a échoué : mieux vaut un rappel perdu qu'une boucle
    // qui réessaie le même destinataire à chaque exécution.
    await prisma.draft.update({
      where: { id: draft.id },
      data: { nudge1SentAt: new Date() },
    });
    sent1++;
  }

  // ── 2e relance : « toujours en brouillon » ───────────────────────────────
  // `updatedAt` doit lui aussi être ancien : un vendeur revenu saisir deux
  // champs il y a dix minutes n'a pas besoin qu'on lui dise qu'il a abandonné.
  const secondCandidates = await prisma.draft.findMany({
    where: {
      nudge2SentAt: null,
      nudge1SentAt: { lte: new Date(now - DRAFT_RELANCE_2_AFTER_MS) },
      updatedAt: { lte: new Date(now - DRAFT_RELANCE_2_AFTER_MS) },
    },
    select,
    orderBy: { updatedAt: "asc" },
    take: MAX_PER_RUN,
  });

  let sent2 = 0;
  for (const draft of secondCandidates) {
    const who = await resolveRecipient(draft);
    if ("skip" in who) {
      noteSkip(who.skip);
      continue;
    }

    await sendEmail({
      to: who.email,
      toName: who.name,
      subject: "Votre annonce est toujours en brouillon",
      html: draftReminderEmail({
        name: who.name,
        title: readTitle(draft.payload),
        category: categoryLabel(draft.category),
        ctaUrl: CTA_URL,
        deleteOn: formatDate(new Date(draft.updatedAt.getTime() + DRAFT_KEEP_DAYS * DAY_MS)),
      }),
      adSource: "draft_relance_2",
      userId: draft.userId,
    }).catch((err) => console.error("[draft-relance] 2e relance échec:", err));

    await prisma.draft.update({
      where: { id: draft.id },
      data: { nudge2SentAt: new Date() },
    });
    sent2++;
  }

  return NextResponse.json({
    purged: purged.count,
    relance1: { candidates: firstCandidates.length, sent: sent1 },
    relance2: { candidates: secondCandidates.length, sent: sent2 },
    skipReasons,
  });
}

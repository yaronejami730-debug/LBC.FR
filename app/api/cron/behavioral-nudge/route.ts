

/**
 * Cron — relance comportementale (publish_nudge).
 *
 * Pré-filtre les candidats à fort potentiel (brouillon vivant ou allers-retours
 * sur /post), demande à `decideForUser` si on envoie, puis pousse l'email.
 *
 * Garde-fous : `CRON_SECRET` Bearer, batch plafonné, jamais sur compte banni /
 * restreint / sans consentement (gérés par `decideForUser`).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { decideForUser, NUDGE_EMAIL_TYPE } from "@/lib/behavioral/decide";
import { publishNudgeEmail } from "@/lib/emails/publish-nudge";
import { pushToUser } from "@/lib/push";

const DAY_MS = 86_400_000;
const MAX_NUDGES_PER_RUN = 200;
const BASE_URL = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const ago7 = new Date(now - 7 * DAY_MS);
  const ago30 = new Date(now - 30 * DAY_MS);

  // Pré-sélection : utilisateurs avec brouillon vivant OU visites /post récentes.
  const [draftUsers, postVisitors] = await Promise.all([
    prisma.draft.findMany({
      where: { updatedAt: { gte: ago30 }, completeness: { gt: 0 } },
      select: { userId: true },
      take: 5_000,
    }),
    prisma.userEvent.findMany({
      where: {
        kind: "page_view",
        path: { startsWith: "/post" },
        userId: { not: null },
        createdAt: { gte: ago7 },
      },
      select: { userId: true },
      distinct: ["userId"],
      take: 5_000,
    }),
  ]);

  const candidateIds = new Set<string>();
  for (const d of draftUsers) candidateIds.add(d.userId);
  for (const e of postVisitors) if (e.userId) candidateIds.add(e.userId);

  let sent = 0;
  let skipped = 0;
  const reasonCounts: Record<string, number> = {};

  for (const userId of candidateIds) {
    if (sent >= MAX_NUDGES_PER_RUN) break;
    const decision = await decideForUser(prisma, userId);
    if (!decision.envoyer) {
      skipped++;
      reasonCounts[decision.raison] = (reasonCounts[decision.raison] ?? 0) + 1;
      continue;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (!user) {
      skipped++;
      continue;
    }

    if (decision.canal === "push") {
      const r = await pushToUser(prisma, userId, {
        title: decision.message,
        body: "Reprendre votre publication",
        url: `${BASE_URL}/post`,
        tag: "publish-nudge",
      });
      if (r.ok > 0) {
        // L'event « envoi » est tracé manuellement pour push (sendEmail ne
        // tourne pas). Maintient cooldown 3j + cap hebdo cohérents quels que
        // soient les canaux utilisés.
        prisma.emailEvent
          .create({
            data: {
              userId,
              email: user.email,
              emailType: NUDGE_EMAIL_TYPE,
              kind: "sent",
              url: "push",
            },
          })
          .catch(() => { });
        sent++;
      } else {
        // Push KO → repli email immédiat plutôt que de gâcher le créneau.
        await sendEmail({
          to: user.email,
          toName: user.name,
          subject: decision.message,
          html: publishNudgeEmail({
            name: user.name,
            message: decision.message,
            category: typeof decision.debug.friction.detail.category === "string"
              ? decision.debug.friction.detail.category as string
              : null,
            ctaUrl: `${BASE_URL}/post`,
          }),
          adSource: NUDGE_EMAIL_TYPE,
          userId,
        }).catch((err) => console.error("[nudge] email-fallback échec:", err));
        sent++;
      }
    } else {
      // L'event `sent` est enregistré automatiquement par `sendEmail`
      // (lib/email.ts) sur la base de `adSource`.
      await sendEmail({
        to: user.email,
        toName: user.name,
        subject: decision.message,
        html: publishNudgeEmail({
          name: user.name,
          message: decision.message,
          category: typeof decision.debug.friction.detail.category === "string"
            ? decision.debug.friction.detail.category as string
            : null,
          ctaUrl: `${BASE_URL}/post`,
        }),
        adSource: NUDGE_EMAIL_TYPE,
        userId,
      }).catch((err) => console.error("[nudge] send échec:", err));
      sent++;
    }
  }

  return NextResponse.json({
    candidates: candidateIds.size,
    sent,
    skipped,
    skipReasons: reasonCounts,
  });
}

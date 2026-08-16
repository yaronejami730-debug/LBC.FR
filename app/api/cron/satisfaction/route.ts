/**
 * Collecte de satisfaction — détection puis envoi.
 *
 * Un seul point d'entrée pour les trois étapes du cycle, plutôt que trois tâches
 * planifiées. Elles s'enchaînent dans un ordre imposé — détecter, puis envoyer
 * ce qui a mûri — et les séparer n'apporterait que le risque de les voir tourner
 * dans le désordre, pour un budget de tâches déjà bien occupé.
 *
 * L'exécution est sans effet si elle a lieu deux fois : les campagnes ouvertes
 * sont protégées par un index unique partiel, et l'envoi réserve chaque ligne
 * avant d'appeler Brevo.
 *
 *   `?dryRun=1` détecte et rapporte sans rien ouvrir ni envoyer.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openCampaign, publishedListingCount } from "@/lib/satisfaction/engine";
import { sendDueCampaigns } from "@/lib/satisfaction/send";
import { periodicDelayDays } from "@/lib/satisfaction/config";
import { getSatisfactionSettings } from "@/lib/satisfaction/settings";

export const runtime = "nodejs";
export const maxDuration = 300;

const DAY_MS = 86_400_000;
/** Comptes examinés par passage. Le reste attendra le suivant. */
const SCAN_LIMIT = 400;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expected = process.env.CRON_SECRET;
  if (!expected || (secret !== expected && bearer !== expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Lus une fois pour tout le passage : les repasser à chaque compte examiné
  // ferait autant de requêtes que de candidats.
  const cfg = await getSatisfactionSettings();
  if (!cfg.enabled) {
    return NextResponse.json({ disabled: true });
  }

  const dryRun = url.searchParams.get("dryRun") === "1";
  const now = new Date();
  const opened = { activity: 0, periodic: 0 };
  const skipped: Record<string, number> = {};
  const note = (reason: string) => void (skipped[reason] = (skipped[reason] ?? 0) + 1);

  // ── 1. Activité ────────────────────────────────────────────────────────
  //
  // On part des annonces publiées récemment plutôt que de parcourir les
  // comptes : seuls ceux qui ont fait quelque chose peuvent avoir atteint le
  // seuil, et ils sont mille fois moins nombreux que les inscrits.
  if (cfg.activityEnabled) {
    const since = new Date(now.getTime() - cfg.burstWindowHours * 3_600_000 * 3);

    const recent = await prisma.listing.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: since }, deletedAt: null, status: "APPROVED" },
      _count: { _all: true },
      having: { userId: { _count: { gte: cfg.activityThreshold } } },
      orderBy: { _count: { userId: "desc" } },
      take: SCAN_LIMIT,
    });

    for (const row of recent) {
      if (dryRun) {
        const count = await publishedListingCount(row.userId, since);
        if (count >= cfg.activityThreshold) opened.activity++;
        continue;
      }
      const result = await openCampaign(row.userId, "ACTIVITY", now, cfg);
      if (result.created) opened.activity++;
      else note(result.reason);
    }
  }

  // ── 2. Périodique ──────────────────────────────────────────────────────
  //
  // Les comptes jamais sollicités d'abord, puis les plus anciennement
  // sollicités. La borne basse écarte d'emblée ceux qui sont trop récents pour
  // être concernés, quelle que soit leur date de tirage.
  if (cfg.periodicEnabled) {
    const oldest = new Date(now.getTime() - cfg.periodicMinDays * DAY_MS);

    const candidates = await prisma.user.findMany({
      where: {
        role: "USER",
        emailVerified: true,
        bannedAt: null,
        restrictedAt: null,
        createdAt: { lte: oldest },
        satisfactionCampaigns: { none: { status: { in: ["PENDING", "SCHEDULED"] } } },
      },
      orderBy: { createdAt: "asc" },
      take: SCAN_LIMIT,
      select: { id: true, createdAt: true },
    });

    for (const user of candidates) {
      // Filtre bon marché avant la vérification complète : inutile d'interroger
      // les campagnes et les préférences d'un compte dont la date tirée n'est
      // pas encore atteinte.
      const ageDays = (now.getTime() - user.createdAt.getTime()) / DAY_MS;
      if (ageDays < periodicDelayDays(user.id, cfg)) {
        note("PERIODIC_NOT_DUE");
        continue;
      }

      if (dryRun) {
        opened.periodic++;
        continue;
      }

      const result = await openCampaign(user.id, "PERIODIC", now, cfg);
      if (result.created) opened.periodic++;
      else note(result.reason);

      // Étalement : on n'ouvre pas plus de campagnes qu'on n'en enverra.
      if (opened.periodic >= cfg.maxSendsPerRun) break;
    }
  }

  // ── 3. Envoi de ce qui a mûri ──────────────────────────────────────────
  const sending = dryRun
    ? { examined: 0, sent: 0, cancelled: 0, failed: 0 }
    : await sendDueCampaigns(cfg.maxSendsPerRun, now);

  return NextResponse.json({ dryRun, opened, skipped, sending });
}

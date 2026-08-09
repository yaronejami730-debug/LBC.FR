/**
 * Dossier de confiance d'un compte — la vue que lit un modérateur.
 *
 * `lib/trust-score.ts` calcule un score sur le chemin critique (publication,
 * envoi de message) : il doit rester rapide, donc pauvre en requêtes. Ce
 * fichier fait l'inverse. Il n'est appelé que depuis le back-office, où l'on
 * peut se permettre une dizaine de requêtes, et il rend un score **expliqué** :
 * chaque point gagné ou perdu porte un libellé lisible et une valeur observée.
 *
 * Le principe : un score n'a de valeur pour un modérateur que s'il montre son
 * raisonnement. « 18/100 » ne dit rien ; « 18/100 — téléphone non vérifié,
 * 4 annonces retirées, photos réutilisées sur 3 comptes » se vérifie et se
 * conteste. C'est pour ça que la fonction renvoie les signaux, pas seulement
 * le total.
 *
 * Quatre familles de signaux, dans l'ordre de fiabilité décroissante :
 *
 *   1. **Identité vérifiée** — email, téléphone, SIRET contrôlé. Coûteux à
 *      falsifier, donc fortement pondéré.
 *   2. **Qualité du contenu** — photos, longueur de description, champs
 *      obligatoires de la catégorie, prix cohérent. Déjà mesuré annonce par
 *      annonce par `computeQualityScore`, agrégé ici.
 *   3. **Historique de modération** — signalements reçus, refus, retraits,
 *      messages bloqués. Des faits, pas des présomptions.
 *   4. **Comportement** — cadence de publication, réutilisation de photos,
 *      appareils partagés avec d'autres comptes, réécriture d'une annonce
 *      retirée. Le plus prédictif, mais aussi le plus bruyant : ces signaux
 *      pèsent moins lourd individuellement et ne déclenchent jamais seuls.
 *
 * Le score reste une **aide à la décision**. Aucune sanction n'est prise à
 * partir de lui : il ordonne la file de modération et explique un dossier, le
 * modérateur tranche.
 */

import { prisma } from "@/lib/prisma";

export type TrustLevel = "high" | "medium" | "low" | "critical";

export type TrustSignal = {
  key: string;
  /** Libellé lisible affiché dans le dossier. */
  label: string;
  /** Points ajoutés (positif) ou retirés (négatif). */
  delta: number;
  /** Valeur observée, affichée à côté du libellé. */
  detail?: string;
  family: "identite" | "contenu" | "moderation" | "comportement";
};

export type TrustProfile = {
  score: number;
  level: TrustLevel;
  levelLabel: string;
  signals: TrustSignal[];
  /** Compteurs bruts, pour les colonnes de tableau. */
  stats: {
    listings: number;
    approved: number;
    removed: number;
    rejected: number;
    reports: number;
    blockedMessages: number;
    flaggedMessages: number;
    accountAgeDays: number;
    avgQuality: number | null;
    sharedDevices: number;
    duplicateImages: number;
  };
};

export function levelFor(score: number): TrustLevel {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  if (score >= 25) return "low";
  return "critical";
}

export function levelLabel(level: TrustLevel): string {
  return {
    high: "Confiance élevée",
    medium: "Confiance moyenne",
    low: "Confiance faible",
    critical: "Risque élevé",
  }[level];
}

/** Couleur du niveau — partagée par la jauge, les badges et les pastilles. */
export const LEVEL_COLORS: Record<TrustLevel, { bar: string; text: string; bg: string; dot: string }> = {
  high: { bar: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  medium: { bar: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", dot: "bg-amber-500" },
  low: { bar: "bg-orange-500", text: "text-orange-700", bg: "bg-orange-50", dot: "bg-orange-500" },
  critical: { bar: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50", dot: "bg-rose-500" },
};

const DAY = 86_400_000;

/**
 * Construit le dossier complet d'un compte.
 *
 * Part de 50 — l'inconnu n'est ni suspect ni fiable — puis applique les
 * signaux. Un compte neuf sans historique reste donc au milieu de l'échelle,
 * ce qui est la seule position honnête à son sujet.
 */
export async function buildTrustProfile(userId: string): Promise<TrustProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      createdAt: true,
      emailVerified: true,
      phoneVerified: true,
      phoneNumber: true,
      verified: true,
      isPro: true,
      siret: true,
      professionalStatus: true,
      totalReportsAgainst: true,
      rejectedListingCount: true,
      bannedAt: true,
      restrictedAt: true,
      spamScore: true,
      lastLoginAt: true,
    },
  });
  if (!user) return null;

  const [
    listingAgg,
    approved,
    removed,
    rejected,
    openReports,
    blockedMessages,
    flaggedMessages,
    dupImages,
    devices,
    recentListings,
    removalEvents,
  ] = await Promise.all([
    prisma.listing.aggregate({
      where: { userId, deletedAt: null },
      _avg: { qualityScore: true, riskScore: true },
      _count: { _all: true },
    }),
    prisma.listing.count({ where: { userId, status: "APPROVED", deletedAt: null } }),
    prisma.listing.count({ where: { userId, status: "REMOVED" } }),
    prisma.listing.count({ where: { userId, status: "REJECTED" } }),
    prisma.report.count({ where: { userId, status: "OPEN" } }),
    prisma.moderationEvent.count({ where: { userId, action: "message_blocked" } }),
    prisma.message.count({ where: { senderId: userId, flagged: true } }),
    prisma.listing.count({ where: { userId, imageDupCount: { gt: 0 } } }),
    prisma.deviceSession.findMany({
      where: { userId },
      select: { fingerprint: true, ipHash: true },
      take: 25,
    }),
    prisma.listing.count({ where: { userId, createdAt: { gte: new Date(Date.now() - DAY) } } }),
    prisma.moderationEvent.count({ where: { userId, action: "listing_removed" } }),
  ]);

  // Appareils/IP partagés avec d'autres comptes : signal de multi-comptes.
  const fingerprints = devices.map((d) => d.fingerprint).filter((f): f is string => !!f);
  const ipHashes = devices.map((d) => d.ipHash).filter(Boolean);
  const sharedDevices =
    fingerprints.length + ipHashes.length === 0
      ? 0
      : await prisma.deviceSession
          .findMany({
            where: {
              userId: { not: userId },
              OR: [
                ...(fingerprints.length ? [{ fingerprint: { in: fingerprints } }] : []),
                ...(ipHashes.length ? [{ ipHash: { in: ipHashes } }] : []),
              ],
            },
            select: { userId: true },
            distinct: ["userId"],
            take: 20,
          })
          .then((rows) => rows.length)
          .catch(() => 0);

  const totalListings = listingAgg._count._all;
  const avgQuality = listingAgg._avg.qualityScore ?? null;
  const avgRisk = listingAgg._avg.riskScore ?? 0;
  const ageDays = Math.floor((Date.now() - user.createdAt.getTime()) / DAY);

  const signals: TrustSignal[] = [];
  const add = (s: TrustSignal) => {
    if (s.delta !== 0) signals.push(s);
  };

  let score = 50;

  // ── 1. Identité ───────────────────────────────────────────────────────────
  if (user.emailVerified) {
    score += 8;
    add({ key: "email_verified", label: "Adresse email vérifiée", delta: 8, family: "identite" });
  } else {
    score -= 8;
    add({ key: "email_unverified", label: "Adresse email non vérifiée", delta: -8, family: "identite" });
  }

  if (user.phoneVerified) {
    score += 12;
    add({ key: "phone_verified", label: "Téléphone vérifié", delta: 12, family: "identite" });
  } else if (user.phoneNumber) {
    score -= 4;
    add({
      key: "phone_unverified",
      label: "Téléphone renseigné mais non vérifié",
      delta: -4,
      family: "identite",
    });
  } else {
    score -= 8;
    add({ key: "phone_missing", label: "Aucun téléphone", delta: -8, family: "identite" });
  }

  if (user.professionalStatus === "APPROVED" && user.siret) {
    score += 15;
    add({
      key: "pro_verified",
      label: "Compte professionnel vérifié",
      detail: "SIRET contrôlé",
      delta: 15,
      family: "identite",
    });
  } else if (user.professionalStatus === "SUSPENDED") {
    score -= 15;
    add({ key: "pro_suspended", label: "Habilitation professionnelle suspendue", delta: -15, family: "identite" });
  }

  if (user.verified) {
    score += 5;
    add({ key: "admin_verified", label: "Badge de vérification accordé", delta: 5, family: "identite" });
  }

  // ── 2. Ancienneté ─────────────────────────────────────────────────────────
  if (ageDays >= 365) {
    score += 10;
    add({ key: "age_1y", label: "Compte de plus d'un an", detail: `${ageDays} jours`, delta: 10, family: "identite" });
  } else if (ageDays >= 90) {
    score += 6;
    add({ key: "age_90d", label: "Compte de plus de 3 mois", detail: `${ageDays} jours`, delta: 6, family: "identite" });
  } else if (ageDays < 7) {
    score -= 6;
    add({ key: "age_new", label: "Compte créé cette semaine", detail: `${ageDays} jour(s)`, delta: -6, family: "identite" });
  }

  // ── 3. Qualité du contenu ─────────────────────────────────────────────────
  if (totalListings >= 3 && avgQuality !== null) {
    if (avgQuality >= 75) {
      score += 14;
      add({
        key: "content_excellent",
        label: "Annonces complètes et soignées",
        detail: `qualité moyenne ${Math.round(avgQuality)}/100`,
        delta: 14,
        family: "contenu",
      });
    } else if (avgQuality >= 60) {
      score += 7;
      add({
        key: "content_good",
        label: "Annonces correctement remplies",
        detail: `qualité moyenne ${Math.round(avgQuality)}/100`,
        delta: 7,
        family: "contenu",
      });
    } else if (avgQuality < 40) {
      score -= 14;
      add({
        key: "content_poor",
        label: "Annonces pauvres (photos ou description manquantes)",
        detail: `qualité moyenne ${Math.round(avgQuality)}/100`,
        delta: -14,
        family: "contenu",
      });
    }
  } else if (totalListings > 0 && avgQuality !== null && avgQuality < 35) {
    score -= 6;
    add({
      key: "content_weak_first",
      label: "Première annonce très incomplète",
      detail: `qualité ${Math.round(avgQuality)}/100`,
      delta: -6,
      family: "contenu",
    });
  }

  if (approved >= 20) {
    score += 10;
    add({ key: "history_20", label: "Historique de publication établi", detail: `${approved} annonces en ligne`, delta: 10, family: "contenu" });
  } else if (approved >= 5) {
    score += 5;
    add({ key: "history_5", label: "Plusieurs annonces publiées", detail: `${approved}`, delta: 5, family: "contenu" });
  }

  // ── 4. Historique de modération ───────────────────────────────────────────
  if (user.totalReportsAgainst > 0) {
    const delta = -Math.min(20, user.totalReportsAgainst * 4);
    score += delta;
    add({
      key: "reports",
      label: "Signalements reçus",
      detail: `${user.totalReportsAgainst}${openReports ? ` · ${openReports} ouvert(s)` : ""}`,
      delta,
      family: "moderation",
    });
  }

  if (rejected > 0) {
    const delta = -Math.min(15, rejected * 3);
    score += delta;
    add({ key: "rejected", label: "Annonces refusées", detail: `${rejected}`, delta, family: "moderation" });
  }

  if (removed > 0) {
    const delta = -Math.min(20, removed * 5);
    score += delta;
    add({ key: "removed", label: "Annonces retirées après publication", detail: `${removed}`, delta, family: "moderation" });
  }

  if (blockedMessages > 0) {
    const delta = -Math.min(15, blockedMessages * 3);
    score += delta;
    add({ key: "messages_blocked", label: "Messages bloqués à l'envoi", detail: `${blockedMessages}`, delta, family: "moderation" });
  }

  if (flaggedMessages > 0) {
    const delta = -Math.min(10, flaggedMessages * 2);
    score += delta;
    add({ key: "messages_flagged", label: "Messages signalés par le filtre", detail: `${flaggedMessages}`, delta, family: "moderation" });
  }

  if (user.restrictedAt) {
    score -= 20;
    add({ key: "restricted", label: "Compte déjà restreint", delta: -20, family: "moderation" });
  }

  if (user.bannedAt) {
    score -= 40;
    add({ key: "banned", label: "Compte banni", delta: -40, family: "moderation" });
  }

  // ── 5. Comportement ───────────────────────────────────────────────────────
  //
  // Aucun de ces signaux ne suffit à condamner un compte : une photo réutilisée
  // peut être une republication légitime, une IP partagée peut être un foyer ou
  // un réseau d'entreprise. Ils pèsent donc peu, et servent surtout à faire
  // remonter un dossier vers le haut de la file.
  if (dupImages > 0) {
    const delta = -Math.min(12, dupImages * 4);
    score += delta;
    add({
      key: "duplicate_images",
      label: "Photos déjà vues ailleurs sur le site",
      detail: `${dupImages} annonce(s)`,
      delta,
      family: "comportement",
    });
  }

  if (sharedDevices > 0) {
    const delta = -Math.min(12, sharedDevices * 4);
    score += delta;
    add({
      key: "shared_devices",
      label: "Appareil ou IP partagés avec d'autres comptes",
      detail: `${sharedDevices} compte(s)`,
      delta,
      family: "comportement",
    });
  }

  if (recentListings >= 10) {
    score -= 10;
    add({
      key: "burst",
      label: "Publication en rafale",
      detail: `${recentListings} annonces en 24 h`,
      delta: -10,
      family: "comportement",
    });
  }

  // Retirer, corriger, se faire retirer à nouveau : c'est le motif de
  // contournement le plus courant, et il ne se voit que sur la durée.
  if (removalEvents >= 3) {
    score -= 12;
    add({
      key: "repeat_removal",
      label: "Retraits répétés malgré corrections",
      detail: `${removalEvents} retraits`,
      delta: -12,
      family: "comportement",
    });
  }

  if (avgRisk >= 50) {
    score -= 10;
    add({
      key: "risk_engine",
      label: "Score de risque élevé sur les annonces",
      detail: `moyenne ${Math.round(avgRisk)}/100`,
      delta: -10,
      family: "comportement",
    });
  }

  if (user.spamScore >= 20) {
    const delta = -Math.min(12, Math.round(user.spamScore / 4));
    score += delta;
    add({ key: "spam_score", label: "Signaux de spam accumulés", detail: `${user.spamScore}`, delta, family: "comportement" });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = levelFor(score);

  // Le poids le plus lourd en premier : c'est ce qu'un modérateur lit d'abord.
  signals.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    score,
    level,
    levelLabel: levelLabel(level),
    signals,
    stats: {
      listings: totalListings,
      approved,
      removed,
      rejected,
      reports: user.totalReportsAgainst,
      blockedMessages,
      flaggedMessages,
      accountAgeDays: ageDays,
      avgQuality: avgQuality === null ? null : Math.round(avgQuality),
      sharedDevices,
      duplicateImages: dupImages,
    },
  };
}

/**
 * Version allégée pour les listes : score et niveau, sans les requêtes
 * comportementales. Une liste de 50 comptes ne peut pas payer 11 requêtes par
 * ligne — elle affiche le score persisté, recalculé par le cron de trust.
 */
export function quickLevel(trustScore: number): { level: TrustLevel; label: string } {
  const level = levelFor(trustScore);
  return { level, label: levelLabel(level) };
}

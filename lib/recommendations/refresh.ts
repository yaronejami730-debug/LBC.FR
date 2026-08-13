/**
 * Rafraîchissement par lots des profils géographiques et catégoriels.
 *
 * Les profils sont un cache : ils se reconstruisent entièrement à partir des
 * annonces, des favoris, des alertes et du journal `UserEvent`. Les recalculer
 * en continu au fil des clics coûterait cher pour rien — un intérêt catégoriel
 * ne bascule pas sur une consultation. Un passage périodique par lots suffit.
 *
 * La sélection des comptes à traiter s'appuie sur un événement de passage
 * (`reco_profile_refresh`) plutôt que sur la fraîcheur des profils eux-mêmes :
 * un compte dont aucune zone n'est exploitable ne produit aucune ligne, et
 * serait donc éternellement « périmé ». Sans cette trace, il reviendrait à
 * chaque exécution et empêcherait les autres d'être traités.
 */

import { prisma } from "@/lib/prisma";
import { refreshUserLocationProfile } from "./location-profile";
import { refreshUserCategoryInterest } from "./category-interest";

const REFRESH_EVENT = "reco_profile_refresh";

export type RefreshResult = {
  processed: number;
  withZones: number;
  withInterests: number;
  errors: number;
};

/**
 * Rafraîchit les profils d'un lot de comptes.
 *
 * @param limit      nombre de comptes traités
 * @param staleDays  âge au-delà duquel un profil est réexaminé
 * @param userIds    force un ensemble précis (tests, rattrapage ciblé)
 */
export async function refreshProfiles({
  limit = 500,
  staleDays = 3,
  userIds,
  now = new Date(),
}: {
  limit?: number;
  staleDays?: number;
  userIds?: string[];
  now?: Date;
} = {}): Promise<RefreshResult> {
  let targets: string[];

  if (userIds?.length) {
    targets = userIds;
  } else {
    const cutoff = new Date(now.getTime() - staleDays * 86_400_000);

    const recent = await prisma.userEvent.findMany({
      where: { kind: REFRESH_EVENT, createdAt: { gte: cutoff } },
      select: { userId: true },
      take: 50_000,
    });
    const done = new Set(recent.map((e) => e.userId).filter((id): id is string => !!id));

    const users = await prisma.user.findMany({
      where: {
        role: "USER",
        bannedAt: null,
        ...(done.size > 0 ? { id: { notIn: [...done] } } : {}),
      },
      // Les comptes actifs d'abord : ce sont eux qui recevront des emails, et
      // leur profil est celui qui a le plus bougé depuis le dernier passage.
      orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: { id: true },
    });
    targets = users.map((u) => u.id);
  }

  const result: RefreshResult = { processed: 0, withZones: 0, withInterests: 0, errors: 0 };

  for (const userId of targets) {
    try {
      const [location, interest] = await Promise.all([
        refreshUserLocationProfile(userId, now),
        refreshUserCategoryInterest(userId, now),
      ]);
      result.processed++;
      if (location.zones > 0) result.withZones++;
      if (interest.categories > 0) result.withInterests++;

      await prisma.userEvent
        .create({
          data: {
            userId,
            kind: REFRESH_EVENT,
            meta: JSON.stringify({ zones: location.zones, categories: interest.categories }),
          },
        })
        .catch(() => {});
    } catch (err) {
      result.errors++;
      console.error("[reco] rafraîchissement échoué", userId, err);
    }
  }

  return result;
}

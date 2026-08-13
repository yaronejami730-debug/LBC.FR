"use server";

/**
 * Actions de l'écran « Recommandations ».
 *
 * La simulation est la seule opération offerte depuis l'administration. Le
 * déclenchement d'un envoi réel reste au planificateur : un bouton « envoyer
 * maintenant » dans une interface web, c'est une double exécution un jour de
 * fatigue, et des milliers d'emails en double.
 */

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { runCategoryCampaign, type CampaignResult } from "@/lib/recommendations/engine";
import { refreshProfiles } from "@/lib/recommendations/refresh";
import { CATEGORIES } from "@/lib/categories";

async function requireAdmin(): Promise<void> {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    throw new Error("Accès refusé");
  }
}

export type SimulationSummary = {
  categoryLabel: string;
  listingCount: number;
  candidateUsers: number;
  targetedUsers: number;
  exclusions: Record<string, number>;
  lines: CampaignResult["lines"];
};

/** Rejoue une catégorie en simulation : rien n'est envoyé, tout est expliqué. */
export async function simulateCampaign(categoryId: string): Promise<SimulationSummary> {
  await requireAdmin();

  const label = CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId;
  const result = await runCategoryCampaign({ categoryLabel: label, dryRun: true });

  revalidatePath("/admin/recommandations");

  return {
    categoryLabel: result.categoryLabel,
    listingCount: result.listingCount,
    candidateUsers: result.candidateUsers,
    targetedUsers: result.targetedUsers,
    exclusions: result.exclusions,
    lines: result.lines
      .sort((a, b) => b.score - a.score)
      .slice(0, 100),
  };
}

/** Reconstruit les profils d'un lot de comptes à la demande. */
export async function refreshProfilesNow(limit = 200): Promise<{ processed: number; withZones: number }> {
  await requireAdmin();
  const result = await refreshProfiles({ limit });
  revalidatePath("/admin/recommandations");
  return { processed: result.processed, withZones: result.withZones };
}

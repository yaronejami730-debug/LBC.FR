/**
 * Réglages de la régie.
 *
 * Un seul réglage aujourd'hui — la diffusion suggérée — mais il mérite d'être
 * lu au bon endroit : le moteur le consulte à chaque sélection, l'administration
 * l'écrit une fois par trimestre. D'où un cache court, et une valeur par défaut
 * prudente : en cas de base injoignable, on retombe sur la diffusion classique
 * plutôt que sur un comportement que personne n'a demandé.
 */
import { prisma } from "@/lib/prisma";

const TTL_MS = 60_000;
let cache: { at: number; values: Map<string, string> } | null = null;

async function all(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.values;
  try {
    const rows = await prisma.adSetting.findMany();
    const values = new Map(rows.map((r) => [r.key, r.value]));
    cache = { at: Date.now(), values };
    return values;
  } catch {
    return cache?.values ?? new Map();
  }
}

export function invalidateAdSettings(): void {
  cache = null;
}

/**
 * La diffusion suggérée est-elle active ?
 *
 * Tant qu'elle ne l'est pas, la régie fonctionne comme avant : ciblage manuel
 * (emplacement, ville, catégorie) et tirage au sort à éligibilité égale. C'est
 * volontaire — avec une poignée d'annonceurs, classer par pertinence revient à
 * choisir le moins hors-sujet de trois, ce qui n'améliore rien et complique le
 * diagnostic.
 */
export async function smartSuggestionsEnabled(): Promise<boolean> {
  return (await all()).get("smart_suggestions") === "true";
}

export async function setSmartSuggestions(enabled: boolean, by?: string): Promise<void> {
  await prisma.adSetting.upsert({
    where: { key: "smart_suggestions" },
    update: { value: enabled ? "true" : "false", updatedBy: by ?? null },
    create: { key: "smart_suggestions", value: enabled ? "true" : "false", updatedBy: by ?? null },
  });
  invalidateAdSettings();
}

/**
 * Seuil à partir duquel la suggestion vaut la peine d'être proposée.
 *
 * Ce n'est pas un déclencheur automatique : la régie reste une décision
 * commerciale, et personne n'aime qu'un site change de comportement tout seul.
 * L'administration s'en sert pour dire « vous avez assez d'annonceurs
 * maintenant », et l'exploitant coche s'il le veut.
 */
export const SMART_SUGGESTION_THRESHOLD = 5;

/** Annonceurs ayant au moins une campagne diffusable — le stock réel. */
export async function activeAdvertiserCount(): Promise<number> {
  const rows = await prisma.adCampaign
    .findMany({
      where: { status: "ACTIVE" },
      select: { advertiserId: true },
      distinct: ["advertiserId"],
      take: 200,
    })
    .catch(() => []);
  return rows.length;
}

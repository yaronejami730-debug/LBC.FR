/**
 * Lecture et écriture des réglages, avec garde-fous.
 *
 * Les valeurs viennent de la base quand elles y sont, des défauts du code
 * sinon. Vider la table revient donc à revenir aux réglages d'origine, ce qui
 * est le moyen de secours le plus simple qui soit.
 *
 * Les bornes vivent dans `config.ts`, avec le type : le formulaire
 * d'administration est un composant client, et importer ce fichier-ci — qui
 * ouvre Prisma — ferait entrer le pilote PostgreSQL dans le bundle du
 * navigateur. Elles sont réexportées ci-dessous pour que le code serveur n'ait
 * qu'un seul point d'entrée.
 */

import { prisma } from "@/lib/prisma";
import {
  SATISFACTION_CONFIG,
  BOUNDS,
  type SatisfactionSettings,
  type BoundedKey,
} from "./config";

export { BOUNDS };
export type { SatisfactionSettings, BoundedKey };

function clamp(key: BoundedKey, value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const { min, max } = BOUNDS[key];
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/** Réglages effectifs — base si renseignée, défauts du code sinon. */
export async function getSatisfactionSettings(): Promise<SatisfactionSettings> {
  const row = await prisma.satisfactionSetting
    .findUnique({ where: { id: "singleton" } })
    .catch(() => null);

  const merged: SatisfactionSettings = {
    enabled: row?.enabled ?? SATISFACTION_CONFIG.enabled,
    periodicEnabled: row?.periodicEnabled ?? SATISFACTION_CONFIG.periodicEnabled,
    activityEnabled: row?.activityEnabled ?? SATISFACTION_CONFIG.activityEnabled,
    periodicMinDays: row?.periodicMinDays ?? SATISFACTION_CONFIG.periodicMinDays,
    periodicMaxDays: row?.periodicMaxDays ?? SATISFACTION_CONFIG.periodicMaxDays,
    activityThreshold: row?.activityThreshold ?? SATISFACTION_CONFIG.activityThreshold,
    burstWindowHours: row?.burstWindowHours ?? SATISFACTION_CONFIG.burstWindowHours,
    cooldownDays: row?.cooldownDays ?? SATISFACTION_CONFIG.cooldownDays,
    maxSendsPerRun: row?.maxSendsPerRun ?? SATISFACTION_CONFIG.maxSendsPerRun,
  };

  // Les bornes s'appliquent aussi à la lecture : une valeur écrite avant un
  // durcissement des limites ne doit pas continuer de s'appliquer.
  return normalize(merged);
}

/** Ramène un jeu de réglages dans les limites, en préservant leur cohérence. */
export function normalize(input: SatisfactionSettings): SatisfactionSettings {
  const out: SatisfactionSettings = {
    ...input,
    periodicMinDays: clamp("periodicMinDays", input.periodicMinDays, SATISFACTION_CONFIG.periodicMinDays),
    periodicMaxDays: clamp("periodicMaxDays", input.periodicMaxDays, SATISFACTION_CONFIG.periodicMaxDays),
    activityThreshold: clamp("activityThreshold", input.activityThreshold, SATISFACTION_CONFIG.activityThreshold),
    burstWindowHours: clamp("burstWindowHours", input.burstWindowHours, SATISFACTION_CONFIG.burstWindowHours),
    cooldownDays: clamp("cooldownDays", input.cooldownDays, SATISFACTION_CONFIG.cooldownDays),
    maxSendsPerRun: clamp("maxSendsPerRun", input.maxSendsPerRun, SATISFACTION_CONFIG.maxSendsPerRun),
  };

  // Une fenêtre inversée ne veut rien dire : on la referme plutôt que de
  // laisser le tirage produire des délais négatifs.
  if (out.periodicMaxDays < out.periodicMinDays) {
    out.periodicMaxDays = out.periodicMinDays;
  }

  return out;
}

export async function saveSatisfactionSettings(
  input: SatisfactionSettings,
  updatedBy: string,
): Promise<SatisfactionSettings> {
  const safe = normalize(input);

  await prisma.satisfactionSetting.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...safe, updatedBy },
    update: { ...safe, updatedBy },
  });

  return safe;
}

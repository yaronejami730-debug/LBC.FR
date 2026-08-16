"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth-unified";
import { prisma } from "@/lib/prisma";
import {
  saveSatisfactionSettings,
  type SatisfactionSettings,
} from "@/lib/satisfaction/settings";

/**
 * Verrou administrateur.
 *
 * Le rôle est relu en base plutôt que pris dans la session : un compte
 * rétrogradé garde un jeton valide jusqu'à son expiration, et ces réglages
 * décident du volume d'emails envoyés à toute la base.
 */
async function requireAdmin(): Promise<string> {
  const actor = await getAuthUser();
  if (!actor?.id) throw new Error("Accès refusé");
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") throw new Error("Accès refusé");
  return actor.id;
}

export async function updateSatisfactionSettings(
  input: SatisfactionSettings,
): Promise<{ ok: true; settings: SatisfactionSettings } | { ok: false; error: string }> {
  try {
    const adminId = await requireAdmin();
    // `saveSatisfactionSettings` ramène les valeurs dans les bornes : le
    // formulaire ne peut pas produire un silence de zéro jour, même en
    // contournant l'interface.
    const settings = await saveSatisfactionSettings(input, adminId);
    revalidatePath("/admin/satisfaction");
    return { ok: true, settings };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Enregistrement impossible" };
  }
}

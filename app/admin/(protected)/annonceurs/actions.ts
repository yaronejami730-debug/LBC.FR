"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isLeadStatus } from "@/lib/advertiser-budgets";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Accès refusé");

  const roleFromToken = (session.user as unknown as Record<string, unknown>)?.role as
    | string
    | undefined;
  if (roleFromToken === "ADMIN") return;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") throw new Error("Accès refusé");
}

/** Fait avancer une demande dans le pipeline. Horodate le premier contact. */
export async function updateLeadStatus(id: string, status: string) {
  await requireAdmin();
  if (!isLeadStatus(status)) throw new Error("Statut inconnu");

  const current = await prisma.advertiserLead.findUnique({
    where: { id },
    select: { contactedAt: true },
  });

  await prisma.advertiserLead.update({
    where: { id },
    data: {
      status,
      // La date de premier contact ne bouge plus une fois posée : elle sert à
      // mesurer le délai de rappel réel face à la promesse de 24-48 h.
      contactedAt: current?.contactedAt ?? (status === "NEW" ? null : new Date()),
    },
  });

  revalidatePath("/admin/annonceurs");
}

export async function updateLeadNotes(id: string, notes: string) {
  await requireAdmin();
  await prisma.advertiserLead.update({
    where: { id },
    data: { notes: notes.trim().slice(0, 2000) || null },
  });
  revalidatePath("/admin/annonceurs");
}

export async function deleteLead(id: string) {
  await requireAdmin();
  await prisma.advertiserLead.delete({ where: { id } });
  revalidatePath("/admin/annonceurs");
}

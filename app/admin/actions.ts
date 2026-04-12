"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as Record<string, unknown> | undefined)?.role;
  if (!session?.user || role !== "ADMIN") {
    throw new Error("Accès refusé");
  }
  return session;
}

// ── Listings ──────────────────────────────────────────────────────────────────

export async function approveListing(id: string) {
  await requireAdmin();
  await prisma.listing.update({
    where: { id },
    data: { status: "APPROVED", rejectionReason: null },
  });
  revalidatePath("/admin/listings");
  revalidatePath("/");
}

export async function rejectListing(id: string, reason: string) {
  await requireAdmin();
  await prisma.listing.update({
    where: { id },
    data: { status: "REJECTED", rejectionReason: reason || null },
  });
  revalidatePath("/admin/listings");
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function verifyUser(id: string, adminNote?: string) {
  await requireAdmin();
  await prisma.user.update({
    where: { id },
    data: { verified: true, adminNote: adminNote || null },
  });
  revalidatePath("/admin/users");
}

export async function rejectUser(id: string, adminNote: string) {
  await requireAdmin();
  await prisma.user.update({
    where: { id },
    data: { verified: false, adminNote: adminNote || null },
  });
  revalidatePath("/admin/users");
}

// ── Advertisements ────────────────────────────────────────────────────────────

export async function createAdvertisement(formData: FormData) {
  await requireAdmin();
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const imageUrl = formData.get("imageUrl") as string;
  const destinationUrl = formData.get("destinationUrl") as string;

  if (!title || !description || !imageUrl || !destinationUrl) {
    throw new Error("Tous les champs sont requis");
  }

  await prisma.advertisement.create({
    data: { title, description, imageUrl, destinationUrl },
  });
  revalidatePath("/admin/ads");
}

export async function toggleAdStatus(id: string, isActive: boolean) {
  await requireAdmin();
  await prisma.advertisement.update({
    where: { id },
    data: { isActive },
  });
  revalidatePath("/admin/ads");
}

export async function deleteAdvertisement(id: string) {
  await requireAdmin();
  await prisma.advertisement.delete({ where: { id } });
  revalidatePath("/admin/ads");
}

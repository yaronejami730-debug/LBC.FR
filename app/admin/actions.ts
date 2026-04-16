"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { accountInvitationEmail } from "@/lib/emails/account-invitation";
import { listingPublishedEmail } from "@/lib/emails/listing-published";
import { platformDiscoveryEmail } from "@/lib/emails/platform-discovery";
import bcrypt from "bcryptjs";
import crypto from "crypto";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Accès refusé");

  const roleFromToken = (session.user as unknown as Record<string, unknown>)?.role as string | undefined;

  // Fallback: re-check directly in DB if role is missing or not ADMIN in the token
  if (roleFromToken !== "ADMIN") {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (dbUser?.role !== "ADMIN") throw new Error("Accès refusé");
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

function parseScheduleDate(value: FormDataEntryValue | null): Date | null {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export async function createAdvertisement(formData: FormData) {
  await requireAdmin();
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const imageUrl = formData.get("imageUrl") as string;
  const destinationUrl = formData.get("destinationUrl") as string;
  const scheduledAt = parseScheduleDate(formData.get("scheduledAt"));
  const expiresAt = parseScheduleDate(formData.get("expiresAt"));

  if (!title || !description || !imageUrl || !destinationUrl) {
    throw new Error("Tous les champs sont requis");
  }

  // Si une date d'activation est définie et est dans le futur, désactiver pour l'instant
  const isActive = scheduledAt ? scheduledAt <= new Date() : true;

  await prisma.advertisement.create({
    data: { title, description, imageUrl, destinationUrl, scheduledAt, expiresAt, isActive },
  });
  revalidatePath("/admin/ads");
  revalidatePath("/");
  revalidatePath("/search");
}

export async function updateAdvertisement(id: string, formData: FormData) {
  await requireAdmin();
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const imageUrl = formData.get("imageUrl") as string;
  const destinationUrl = formData.get("destinationUrl") as string;
  const scheduledAt = parseScheduleDate(formData.get("scheduledAt"));
  const expiresAt = parseScheduleDate(formData.get("expiresAt"));

  if (!title || !description || !imageUrl || !destinationUrl) {
    throw new Error("Tous les champs sont requis");
  }

  await prisma.advertisement.update({
    where: { id },
    data: { title, description, imageUrl, destinationUrl, scheduledAt, expiresAt },
  });
  revalidatePath("/admin/ads");
  revalidatePath("/");
  revalidatePath("/search");
}

export async function toggleAdStatus(id: string, isActive: boolean) {
  await requireAdmin();
  await prisma.advertisement.update({
    where: { id },
    data: { isActive },
  });
  revalidatePath("/admin/ads");
  revalidatePath("/");
  revalidatePath("/search");
}

export async function deleteAdvertisement(id: string) {
  await requireAdmin();
  await prisma.advertisement.delete({ where: { id } });
  revalidatePath("/admin/ads");
  revalidatePath("/");
  revalidatePath("/search");
}

// ── Client Account Creation ────────────────────────────────────────────────────

export async function createClientAccount(
  email: string,
  name: string,
  isPro: boolean = false,
  companyName: string | null = null,
  siret: string | null = null,
) {
  await requireAdmin();

  if (!email || !name) throw new Error("Email et nom requis");

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw new Error("Un compte avec cet email existe déjà");

  // Random temporary password — will be replaced on activation
  const tempPassword = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name.trim(),
      password: tempPassword,
      verified: false,
      memberSince: new Date().getFullYear(),
      isPro,
      companyName: isPro ? (companyName?.trim() || null) : null,
      siret: isPro ? (siret?.trim() || null) : null,
    },
  });

  // Activation token valid 7 days
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
  // Use /activer-compte for admin-created accounts (handles SIRET step for pros)
  const activationUrl = `${baseUrl}/activer-compte?token=${token}`;

  await sendEmail({
    to: normalizedEmail,
    toName: name.trim(),
    subject: "Votre compte Deal & Co est prêt — Créez votre mot de passe",
    html: accountInvitationEmail({ name: name.trim(), activationUrl }),
  });

  revalidatePath("/admin/create-client");
  return { userId: user.id, email: normalizedEmail, name: name.trim() };
}

export async function resendInvitation(userId: string) {
  await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Utilisateur introuvable");

  // Invalider anciens tokens
  await prisma.passwordResetToken.updateMany({
    where: { userId, used: false },
    data: { used: true },
  });

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
  const activationUrl = `${baseUrl}/reset-password?token=${token}`;

  await sendEmail({
    to: user.email,
    toName: user.name,
    subject: "Votre invitation Deal & Co — Créez votre mot de passe",
    html: accountInvitationEmail({ name: user.name, activationUrl }),
  });
}

// ── Category Settings ─────────────────────────────────────────────────────────

export async function getCategorySettings() {
  await requireAdmin();
  return prisma.categorySetting.findMany();
}

export async function updateCategoryApproval(categoryId: string, approvalMode: "AUTO" | "MANUAL") {
  await requireAdmin();
  await prisma.categorySetting.upsert({
    where: { categoryId },
    update: { approvalMode },
    create: { categoryId, approvalMode },
  });
  revalidatePath("/admin/categories");
}

// ── Discovery Email ────────────────────────────────────────────────────────────

export async function sendDiscoveryEmail(
  email: string,
  target: "tous" | "pro" | "particulier",
  domain: string
) {
  await requireAdmin();

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Adresse email invalide");
  }

  const { subject, html } = platformDiscoveryEmail({ target, domain });

  await sendEmail({
    to: normalizedEmail,
    subject,
    html,
  });
}

export async function createListingForClient(
  userId: string,
  data: {
    title: string;
    price: number;
    category: string;
    subcategory?: string;
    description: string;
    location: string;
    condition: string;
    images: string[];
    phone?: string;
    hidePhone?: boolean;
    metadata?: string;
    brand?: string;
    material?: string;
  }
) {
  await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Utilisateur introuvable");

  if (!data.title || !data.category || !data.description || !data.location) {
    throw new Error("Champs requis manquants");
  }

  const listing = await prisma.listing.create({
    data: {
      title: data.title,
      price: data.price,
      category: data.category,
      subcategory: data.subcategory ?? null,
      description: data.description,
      location: data.location,
      condition: data.condition || "Bon état",
      images: JSON.stringify(data.images ?? []),
      metadata: data.metadata ?? "{}",
      phone: data.phone ?? null,
      hidePhone: data.hidePhone ?? false,
      brand: data.brand ?? null,
      material: data.material ?? null,
      userId,
      status: "APPROVED",
    } as any,
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
  const imgs = data.images ?? [];

  sendEmail({
    to: user.email,
    toName: user.name,
    subject: `Votre annonce "${data.title}" est en ligne — Deal & Co`,
    html: listingPublishedEmail({
      name: user.name,
      listingTitle: data.title,
      listingUrl: `${baseUrl}/annonce/${listing.id}`,
      price: data.price,
      location: data.location,
      imageUrl: imgs[0] ?? undefined,
    }),
  }).catch(() => {});

  revalidatePath("/admin/create-client");
  return { listingId: listing.id };
}

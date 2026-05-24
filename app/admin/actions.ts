"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { accountInvitationEmail } from "@/lib/emails/account-invitation";
import { listingPublishedEmail } from "@/lib/emails/listing-published";
import { listingApprovedEmail } from "@/lib/emails/listing-approved";
import { platformDiscoveryEmail } from "@/lib/emails/platform-discovery";
import { baseEmail } from "@/lib/emails/base";
import { syncSource, parseSourceUrl } from "@/lib/external-sync";
import { normalizePhone, hashPhone } from "@/lib/moderation/phone";
import { pingIndexNow } from "@/lib/indexnow";
import { sendPushNotification } from "@/lib/notifications/send";
import { notifyMatchingSavedSearches } from "@/lib/notify-saved-searches";
import { listingSlug } from "@/lib/listing-slug";
import { CATEGORIES } from "@/lib/categories";
import { citySlug } from "@/lib/cities";
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
  const listing = await prisma.listing.update({
    where: { id },
    data: { status: "APPROVED", rejectionReason: null },
    include: { user: { select: { name: true, email: true, companyName: true, isPro: true } } },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
  const displayName = listing.user.isPro && listing.user.companyName ? listing.user.companyName : listing.user.name;
  sendEmail({
    to: listing.user.email,
    toName: displayName,
    subject: `Votre annonce "${listing.title}" est en ligne — Deal & Co`,
    html: listingApprovedEmail({
      name: displayName,
      listingTitle: listing.title,
      listingUrl: `${baseUrl}/annonce/${listing.id}`,
    }),
  }).catch(() => {});

  sendPushNotification({
    userId: listing.userId,
    template: "listing_approved",
    variables: { listingTitle: listing.title, listingId: listing.id },
  }).catch(() => {});

  notifyMatchingSavedSearches(listing.id).catch(() => {});

  revalidatePath("/admin/listings");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/annonces", "layout");
  revalidatePath(`/annonce/${listing.id}`);

  const listingPublicUrl = `${baseUrl}/annonce/${listing.id}/${listingSlug(listing.title)}`;
  const catId = CATEGORIES.find((c) => c.label === (listing as any).category)?.id;
  const villeSlug = listing.location
    ? citySlug(listing.location.split(/[,(]/)[0]?.trim() ?? listing.location)
    : "";
  const urls = [listingPublicUrl, baseUrl, `${baseUrl}/nouveautes`];
  if (catId) urls.push(`${baseUrl}/annonces/${catId}`);
  if (villeSlug) urls.push(`${baseUrl}/ville/${villeSlug}`);
  if (catId && villeSlug) urls.push(`${baseUrl}/annonces/${catId}/${villeSlug}`);
  pingIndexNow(urls).catch(() => {});
}

export async function rejectListing(id: string, reason: string) {
  await requireAdmin();
  const listing = await prisma.listing.update({
    where: { id },
    data: { status: "REJECTED", rejectionReason: reason || null },
    select: { id: true, title: true, userId: true },
  });

  sendPushNotification({
    userId: listing.userId,
    template: "listing_rejected",
    variables: { listingTitle: listing.title, listingId: listing.id },
  }).catch(() => {});

  revalidatePath("/admin/listings");
  revalidatePath("/admin");
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

export async function banUser(id: string, reason: string) {
  await requireAdmin();
  await prisma.user.update({
    where: { id },
    data: { bannedAt: new Date(), banReason: reason || null },
  });
  // Reject all active listings from this user
  await prisma.listing.updateMany({
    where: { userId: id, status: { in: ["APPROVED", "PENDING"] } },
    data: { status: "REJECTED", rejectionReason: "Compte suspendu" },
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin/listings");
}

export async function unbanUser(id: string) {
  await requireAdmin();
  await prisma.user.update({
    where: { id },
    data: { bannedAt: null, banReason: null },
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
  const imageUrlWide = (formData.get("imageUrlWide") as string) || null;
  const destinationUrl = formData.get("destinationUrl") as string;
  const scheduledAt = parseScheduleDate(formData.get("scheduledAt"));
  const expiresAt = parseScheduleDate(formData.get("expiresAt"));

  if (!title || !description || !imageUrl || !destinationUrl) {
    throw new Error("Tous les champs sont requis");
  }

  // Si une date d'activation est définie et est dans le futur, désactiver pour l'instant
  const isActive = scheduledAt ? scheduledAt <= new Date() : true;

  await prisma.advertisement.create({
    data: { title, description, imageUrl, imageUrlWide, destinationUrl, scheduledAt, expiresAt, isActive },
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
  const imageUrlWide = (formData.get("imageUrlWide") as string) || null;
  const destinationUrl = formData.get("destinationUrl") as string;
  const scheduledAt = parseScheduleDate(formData.get("scheduledAt"));
  const expiresAt = parseScheduleDate(formData.get("expiresAt"));

  if (!title || !description || !imageUrl || !destinationUrl) {
    throw new Error("Tous les champs sont requis");
  }

  await prisma.advertisement.update({
    where: { id },
    data: { title, description, imageUrl, imageUrlWide, destinationUrl, scheduledAt, expiresAt },
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
  // Use /activer-compte so the user goes through SIRET (if pro) and terms acceptance.
  const activationUrl = `${baseUrl}/activer-compte?token=${token}`;

  await sendEmail({
    to: user.email,
    toName: user.name,
    subject: "Votre invitation Deal & Co — Créez votre mot de passe",
    html: accountInvitationEmail({ name: user.name, activationUrl }),
  });
}

/**
 * Relance un utilisateur n'ayant pas accepté les CGU et la politique de
 * confidentialité — déclenchée manuellement par un admin depuis la fiche client.
 *
 * Garde-fous :
 *   - utilisateur introuvable, banni, ou ayant déjà consenti → refus.
 *   - rate-limit côté utilisateur : 1 relance / 24h max.
 */
export async function sendConsentReminderToUser(userId: string) {
  await requireAdmin();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, consentGivenAt: true, bannedAt: true },
  });
  if (!user) throw new Error("Utilisateur introuvable");
  if (user.bannedAt) throw new Error("Utilisateur banni — relance impossible");
  if (user.consentGivenAt) {
    throw new Error("Les CGU sont déjà acceptées par cet utilisateur");
  }

  // Anti-double-clic : si la dernière relance pour ce user date de moins de 24h, refus.
  const lastReminder = await prisma.moderationEvent.findFirst({
    where: { userId, action: "admin_consent_reminder" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (lastReminder && lastReminder.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
    throw new Error("Une relance a déjà été envoyée à cet utilisateur dans les dernières 24 heures");
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
  const { createEmailPrefToken } = await import("@/lib/email-token");
  const { consentReminderEmail } = await import("@/lib/emails/consent-reminder");
  const acceptUrl = `${baseUrl}/accepter-cgu?token=${createEmailPrefToken(user.id)}`;

  await sendEmail({
    to: user.email,
    toName: user.name,
    subject: "Action requise : acceptez nos CGU et notre politique de confidentialité",
    html: consentReminderEmail({ name: user.name, acceptUrl }),
    adSource: "admin-consent-reminder",
    userId: user.id,
  });

  // Trace pour audit + rate-limit.
  const admin = await auth();
  await prisma.moderationEvent.create({
    data: {
      userId: user.id,
      actor: `admin:${admin?.user?.id ?? "unknown"}`,
      action: "admin_consent_reminder",
      reason: "Relance CGU/confidentialité depuis la fiche admin",
    },
  });

  revalidatePath(`/admin/clients/${userId}`);
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

/**
 * Démarchage en masse — envoie un email de pitch à plusieurs destinataires.
 * `rawEmails` : texte libre (adresses séparées par espace, virgule, point-virgule
 * ou retour ligne). `kind` : "agency" (B2B) ou "particulier" (B2C).
 * Le pitch particulier n'utilise pas de prénom (prospects non inscrits → « Bonjour, »).
 */
export async function sendPitchBulk(
  rawEmails: string,
  kind: "agency" | "particulier",
  agencyName: string,
) {
  await requireAdmin();

  const emails = [
    ...new Set(
      (rawEmails ?? "")
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const valid = emails.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  const invalid = emails.filter((e) => !valid.includes(e));
  if (valid.length === 0) throw new Error("Aucune adresse email valide.");

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
  const { agencyPitchEmail } = await import("@/lib/emails/agency-pitch");
  const { particulierPitchEmail } = await import("@/lib/emails/particulier-pitch");
  const name = agencyName.trim();

  const built =
    kind === "agency"
      ? agencyPitchEmail({ agencyName: name || undefined, baseUrl })
      : particulierPitchEmail({ baseUrl }); // pas de prénom → « Bonjour, »
  const adSource = kind === "agency" ? "admin-agency-pitch" : "admin-particulier-pitch";

  let sent = 0;
  let failed = 0;
  const CHUNK = 20; // limite la charge Brevo

  for (let i = 0; i < valid.length; i += CHUNK) {
    const chunk = valid.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      chunk.map((to) =>
        sendEmail({ to, subject: built.subject, html: built.html, adSource }),
      ),
    );
    for (const r of results) {
      if (r.status === "fulfilled") sent++;
      else failed++;
    }
  }

  return { sent, failed, total: valid.length, invalid };
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

export async function updateClientDisplayName(userId: string, companyName: string) {
  await requireAdmin();
  const trimmed = companyName.trim();
  if (!trimmed) throw new Error("Nom requis");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isPro: true } });
  if (!user) throw new Error("Utilisateur introuvable");
  if (!user.isPro) throw new Error("Modification disponible uniquement pour les comptes professionnels");

  await prisma.user.update({
    where: { id: userId },
    data: { companyName: trimmed },
  });

  revalidatePath("/admin/create-client");
  revalidatePath(`/admin/clients/${userId}`);
  return { ok: true };
}

export async function updateUserName(userId: string, name: string) {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Nom requis");
  if (trimmed.length > 120) throw new Error("Nom trop long");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new Error("Utilisateur introuvable");

  await prisma.user.update({ where: { id: userId }, data: { name: trimmed } });

  revalidatePath("/admin/users");
  revalidatePath("/admin/create-client");
  revalidatePath(`/admin/clients/${userId}`);
  return { ok: true };
}

/**
 * Définit le numéro de téléphone unique d'un compte et le propage à toutes
 * ses annonces (existantes). Refuse si le numéro est déjà attribué à un autre compte.
 * Passer une chaîne vide ou null retire le numéro du compte (et des annonces).
 */
export async function updateUserPhone(userId: string, rawPhone: string | null) {
  await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new Error("Utilisateur introuvable");

  const raw = (rawPhone ?? "").trim();
  if (!raw) {
    await prisma.user.update({ where: { id: userId }, data: { phoneNumber: null } });
    await prisma.listing.updateMany({
      where: { userId },
      data: { phone: null, phoneHash: null },
    });
    revalidatePath(`/admin/clients/${userId}`);
    return { ok: true, phone: null };
  }

  const normalized = normalizePhone(raw);
  if (!normalized) throw new Error("Numéro invalide (format FR attendu, ex. 06 12 34 56 78)");

  const existing = await prisma.user.findUnique({
    where: { phoneNumber: normalized },
    select: { id: true, email: true },
  });
  if (existing && existing.id !== userId) {
    throw new Error(`Numéro déjà utilisé par un autre compte (${existing.email})`);
  }

  const hash = hashPhone(normalized);

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { phoneNumber: normalized } }),
    prisma.listing.updateMany({
      where: { userId },
      data: { phone: normalized, phoneHash: hash },
    }),
  ]);

  revalidatePath(`/admin/clients/${userId}`);
  return { ok: true, phone: normalized };
}

// ── Client listings management ────────────────────────────────────────────────

export async function getClientListings(userId: string) {
  await requireAdmin();
  const listings = await prisma.listing.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      price: true,
      category: true,
      subcategory: true,
      description: true,
      location: true,
      condition: true,
      images: true,
      phone: true,
      hidePhone: true,
      status: true,
      createdAt: true,
    },
  });
  return listings.map((l) => ({
    ...l,
    images: (() => {
      try {
        const arr = JSON.parse(l.images);
        return Array.isArray(arr) ? (arr as string[]) : [];
      } catch {
        return [] as string[];
      }
    })(),
    createdAt: l.createdAt.toISOString(),
  }));
}

/**
 * Suppression d'une annonce par un admin (soft delete via `deletedAt`).
 * Désindexe également d'OpenSearch si configuré.
 */
export async function deleteListingByAdmin(listingId: string) {
  await requireAdmin();
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, userId: true },
  });
  if (!listing) throw new Error("Annonce introuvable");

  await prisma.listing.update({
    where: { id: listingId },
    data: { deletedAt: new Date(), shadowBanned: true } as any,
  });

  // Désindexation OpenSearch — fire and forget.
  import("@/lib/opensearch-sync")
    .then((m) => m.deleteListingFromIndex(listingId))
    .catch(() => {});

  prisma.moderationEvent
    .create({
      data: {
        listingId,
        userId: listing.userId,
        actor: "admin",
        action: "admin_delete",
        reason: "Suppression manuelle depuis l'admin",
      } as any,
    })
    .catch(() => {});

  revalidatePath("/admin/listings");
  revalidatePath("/admin");
  revalidatePath("/admin/create-client");
  revalidatePath(`/admin/clients/${listing.userId}`);
  revalidatePath(`/annonce/${listingId}`);
  revalidatePath("/", "layout");
}

export async function updateListingByAdmin(
  listingId: string,
  data: {
    title?: string;
    price?: number;
    description?: string;
    location?: string;
    condition?: string;
    images?: string[];
    phone?: string | null;
    hidePhone?: boolean;
  },
) {
  await requireAdmin();

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) throw new Error("Annonce introuvable");

  const updates: Record<string, unknown> = {};
  if (typeof data.title === "string" && data.title.trim()) updates.title = data.title.trim();
  if (typeof data.price === "number" && !Number.isNaN(data.price) && data.price >= 0) updates.price = data.price;
  if (typeof data.description === "string") updates.description = data.description;
  if (typeof data.location === "string") updates.location = data.location;
  if (typeof data.condition === "string") updates.condition = data.condition;
  if (Array.isArray(data.images)) updates.images = JSON.stringify(data.images.slice(0, 15));
  if (data.phone !== undefined) updates.phone = data.phone;
  if (typeof data.hidePhone === "boolean") updates.hidePhone = data.hidePhone;

  if (Object.keys(updates).length === 0) {
    return { listingId };
  }

  await prisma.listing.update({
    where: { id: listingId },
    data: updates,
  });

  revalidatePath("/admin/create-client");
  revalidatePath(`/admin/clients/${listing.userId}`);
  revalidatePath(`/annonce/${listingId}`);

  return { listingId };
}

// ── Campagnes email ─────────────────────────────────────────────────────────────

export type CampaignAudience = "all" | "pro" | "particulier";

/**
 * Filtre des destinataires d'une campagne.
 * `marketingConsent: true` imposé — campagnes marketing, conformité RGPD.
 * Comptes bannis exclus.
 */
function audienceWhere(audience: CampaignAudience) {
  const base = { marketingConsent: true, bannedAt: null };
  if (audience === "pro") return { ...base, isPro: true };
  if (audience === "particulier") return { ...base, isPro: false };
  return base;
}

/** Nombre de destinataires consentants par segment (pour l'aperçu admin). */
export async function getCampaignCounts() {
  await requireAdmin();
  const [all, pro, particulier] = await Promise.all([
    prisma.user.count({ where: audienceWhere("all") }),
    prisma.user.count({ where: audienceWhere("pro") }),
    prisma.user.count({ where: audienceWhere("particulier") }),
  ]);
  return { all, pro, particulier };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c,
  );
}

/**
 * Envoie une campagne email manuelle à un segment d'utilisateurs consentants.
 * Le message est saisi en texte brut (échappé puis converti en paragraphes).
 */
export async function sendCampaignEmail({
  subject,
  message,
  audience,
}: {
  subject: string;
  message: string;
  audience: CampaignAudience;
}) {
  await requireAdmin();

  const cleanSubject = subject.trim();
  const cleanMessage = message.trim();
  if (cleanSubject.length < 3) throw new Error("Sujet trop court (3 caractères min).");
  if (cleanMessage.length < 10) throw new Error("Message trop court (10 caractères min).");

  const recipients = await prisma.user.findMany({
    where: audienceWhere(audience),
    select: { id: true, email: true, name: true, isPro: true, companyName: true },
  });
  if (recipients.length === 0) return { sent: 0, failed: 0, total: 0 };

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
  const bodyHtml = escapeHtml(cleanMessage)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  let sent = 0;
  let failed = 0;
  const CHUNK = 20; // limite la charge Brevo / le temps de fonction

  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      chunk.map((u) => {
        const displayName = u.isPro && u.companyName ? u.companyName : u.name;
        return sendEmail({
          to: u.email,
          toName: displayName,
          subject: cleanSubject,
          adSource: "admin-campaign", // préfixe "admin" → pas de pub injectée
          userId: u.id, // en-tête List-Unsubscribe (RGPD)
          html: baseEmail({
            title: cleanSubject,
            heading: cleanSubject,
            body: bodyHtml,
            ctaLabel: "Aller sur Deal & Co",
            ctaUrl: baseUrl,
          }),
        });
      }),
    );
    for (const r of results) {
      if (r.status === "fulfilled") sent++;
      else failed++;
    }
  }

  await prisma.moderationEvent
    .create({
      data: {
        actor: "admin",
        action: "email_campaign",
        reason: `audience=${audience} sujet="${cleanSubject}" envoyés=${sent} échecs=${failed}`,
      } as any,
    })
    .catch(() => {});

  return { sent, failed, total: recipients.length };
}

// ── Sources externes ───────────────────────────────────────────────────────────

/** Recherche d'utilisateurs pour le picker de source externe. */
export async function searchUsersForSourcePicker(q: string) {
  await requireAdmin();
  const query = q.trim();
  if (!query) return [];
  const rows = await prisma.user.findMany({
    where: {
      bannedAt: null,
      OR: [
        { email: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
        { companyName: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 10,
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, isPro: true, companyName: true },
  });
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    isPro: r.isPro,
    companyName: r.companyName,
  }));
}

/**
 * Crée une source externe.
 * - Propriétaire : `ownerId` (depuis le picker) ou `ownerEmail` (repli CLI).
 * - URL : parsée serveur → `domain`, `agencySlug`, `kind` auto-détecté.
 *   Le scraper ne crawle QUE l'URL fournie (scope agence/franchisé),
 *   jamais le reste du domaine.
 */
export async function addExternalSource(formData: FormData) {
  await requireAdmin();
  const ownerId = (formData.get("ownerId") as string)?.trim() ?? "";
  const ownerEmail = (formData.get("ownerEmail") as string)?.trim().toLowerCase() ?? "";
  const label = (formData.get("label") as string)?.trim() ?? "";
  const rawUrl = (formData.get("url") as string)?.trim() ?? "";

  if (!label || !rawUrl) throw new Error("Libellé et URL requis.");
  if (!ownerId && !ownerEmail) throw new Error("Sélectionne un compte propriétaire.");

  const parsed = parseSourceUrl(rawUrl);
  if (!parsed) throw new Error("URL invalide.");
  // Pas de connecteur dédié → connecteur générique (heuristiques). Aucune
  // erreur : toute URL d'agence est acceptée.

  let owner;
  if (ownerId) {
    owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true } });
  } else {
    owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  }
  if (!owner) throw new Error("Compte propriétaire introuvable.");

  await prisma.externalSource.create({
    data: {
      ownerId: owner.id,
      label,
      url: parsed.baseUrl,
      kind: parsed.kind,
      domain: parsed.domain,
      agencySlug: parsed.agencySlug,
    } as any,
  });
  revalidatePath("/admin/sources-externes");
}

/** Lance une synchronisation immédiate d'une source. Met à jour `lastSyncedAt` + `lastResult`. */
export async function runExternalSourceSync(id: string) {
  await requireAdmin();
  const source = await prisma.externalSource.findUnique({
    where: { id },
    select: { id: true, ownerId: true, url: true, kind: true, active: true },
  });
  if (!source) throw new Error("Source introuvable.");
  if (!source.active) throw new Error("Source désactivée.");

  const result = await syncSource(prisma, source);

  await prisma.externalSource.update({
    where: { id },
    data: { lastSyncedAt: new Date(), lastResult: JSON.stringify(result) } as any,
  });
  revalidatePath("/admin/sources-externes");
  return result;
}

/**
 * Import unitaire — importe UNE annonce depuis son URL exacte.
 * Idempotent par URL : ré-importer le même lien met l'annonce à jour.
 */
export async function importListingByUrl(ownerId: string, url: string) {
  await requireAdmin();
  const cleanUrl = url.trim();
  if (!ownerId) throw new Error("Sélectionne un compte propriétaire.");
  try {
    new URL(cleanUrl);
  } catch {
    throw new Error("URL invalide.");
  }

  const { extractListingFromUrl } = await import("@/lib/external-extract");
  const { extractImages } = await import("@/lib/external-images");
  const { createExternalListing } = await import("@/lib/external-create");

  const ext = await extractListingFromUrl(cleanUrl);
  if (!ext.ok) throw new Error(`Extraction impossible : ${ext.error}`);

  const images = extractImages(ext.html, cleanUrl);
  const result = await createExternalListing(
    prisma,
    ownerId,
    {
      externalId: `link:${cleanUrl}`,
      sourceUrl: cleanUrl,
      title: ext.data.title,
      description: ext.data.description,
      price: ext.data.price,
      category: ext.data.category,
      subcategory: ext.data.subcategory,
      location: ext.data.location,
      condition: ext.data.condition,
      images,
      phone: ext.data.phone,
      metadata: { vehicle: ext.data.vehicle, immo: ext.data.immo },
    },
    "admin-link-import",
  );
  if (!result.ok) throw new Error(result.error);

  revalidatePath(`/admin/clients/${ownerId}`);
  return {
    listingId: result.listingId,
    status: result.status,
    deduplicated: result.deduplicated,
    title: ext.data.title,
  };
}

export async function toggleExternalSource(id: string, active: boolean) {
  await requireAdmin();
  await prisma.externalSource.update({ where: { id }, data: { active } });
  revalidatePath("/admin/sources-externes");
}

export async function deleteExternalSource(id: string) {
  await requireAdmin();
  await prisma.externalSource.delete({ where: { id } });
  revalidatePath("/admin/sources-externes");
}

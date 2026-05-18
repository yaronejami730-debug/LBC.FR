"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/pet/stripe";
import { randomSuffix, slugify } from "@/lib/pet/slug";

function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_PET_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

async function uniqueSlug(displayName: string): Promise<string> {
  const base = slugify(displayName) || "pro";
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.petProService.findUnique({ where: { slug }, select: { id: true } });
    if (!exists) return slug;
    slug = `${base}-${randomSuffix(4)}`;
  }
  return `${base}-${randomSuffix(8)}`;
}

export async function createProProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/pet/compte-pro");

  const displayName = String(formData.get("displayName") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const postalCode = String(formData.get("postalCode") ?? "").trim() || null;

  if (!displayName || !bio || !city) {
    throw new Error("Champs obligatoires manquants");
  }

  const existing = await prisma.petProService.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (existing) throw new Error("Profil pro déjà créé");

  const slug = await uniqueSlug(displayName);

  await prisma.petProService.create({
    data: {
      userId: session.user.id,
      displayName,
      slug,
      bio,
      city,
      postalCode,
    },
  });

  revalidatePath("/pet/compte-pro");
}

export async function startStripeOnboarding() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/pet/compte-pro");

  const pro = await prisma.petProService.findUnique({
    where: { userId: session.user.id },
  });
  if (!pro) throw new Error("Créer le profil pro d'abord");

  let accountId = pro.stripeAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "FR",
      email: session.user.email ?? undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: "individual",
      metadata: {
        petProServiceId: pro.id,
        userId: session.user.id,
      },
    });
    accountId = account.id;
    await prisma.petProService.update({
      where: { id: pro.id },
      data: { stripeAccountId: accountId },
    });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: appUrl("/pet/compte-pro?onboarding=refresh"),
    return_url: appUrl("/pet/compte-pro?onboarding=return"),
    type: "account_onboarding",
  });

  redirect(link.url);
}

export async function refreshStripeStatus() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/pet/compte-pro");

  const pro = await prisma.petProService.findUnique({
    where: { userId: session.user.id },
  });
  if (!pro?.stripeAccountId) return;

  const account = await stripe.accounts.retrieve(pro.stripeAccountId);

  const chargesEnabled = account.charges_enabled === true;
  const payoutsEnabled = account.payouts_enabled === true;
  const detailsSubmitted = account.details_submitted === true;

  await prisma.petProService.update({
    where: { id: pro.id },
    data: {
      stripeChargesEnabled: chargesEnabled,
      stripePayoutsEnabled: payoutsEnabled,
      kycCompletedAt: chargesEnabled && payoutsEnabled && detailsSubmitted ? pro.kycCompletedAt ?? new Date() : null,
      isPublished: chargesEnabled && payoutsEnabled ? pro.isPublished : false,
    },
  });

  revalidatePath("/pet/compte-pro");
}

export async function publishProfile() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/pet/compte-pro");

  const pro = await prisma.petProService.findUnique({
    where: { userId: session.user.id },
  });
  if (!pro) throw new Error("Profil introuvable");
  if (!pro.stripeChargesEnabled || !pro.stripePayoutsEnabled) {
    throw new Error("Onboarding Stripe incomplet");
  }

  await prisma.petProService.update({
    where: { id: pro.id },
    data: { isPublished: true },
  });

  revalidatePath("/pet/compte-pro");
  revalidatePath(`/pet/pro/${pro.slug}`);
}

export async function createOffering(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/pet/compte-pro");

  const pro = await prisma.petProService.findUnique({
    where: { userId: session.user.id },
    select: { id: true, slug: true },
  });
  if (!pro) throw new Error("Créer le profil pro d'abord");

  const serviceType = String(formData.get("serviceType") ?? "GARDE_DOMICILE");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priceEuros = Number(formData.get("priceEuros") ?? 0);
  const unit = String(formData.get("unit") ?? "DAY");
  const maxPets = Number(formData.get("maxPets") ?? 1);

  if (!title || !description || priceEuros <= 0) {
    throw new Error("Champs obligatoires manquants");
  }

  await prisma.petServiceOffering.create({
    data: {
      proServiceId: pro.id,
      serviceType,
      title,
      description,
      priceCents: Math.round(priceEuros * 100),
      unit,
      maxPets: Math.max(1, Math.min(10, maxPets)),
    },
  });

  revalidatePath("/pet/compte-pro");
  revalidatePath(`/pet/pro/${pro.slug}`);
}

export async function toggleOffering(offeringId: string, isActive: boolean) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/pet/compte-pro");

  const offering = await prisma.petServiceOffering.findUnique({
    where: { id: offeringId },
    include: { proService: { select: { userId: true, slug: true } } },
  });
  if (!offering || offering.proService.userId !== session.user.id) {
    throw new Error("Non autorisé");
  }

  await prisma.petServiceOffering.update({
    where: { id: offeringId },
    data: { isActive },
  });

  revalidatePath("/pet/compte-pro");
  revalidatePath(`/pet/pro/${offering.proService.slug}`);
}

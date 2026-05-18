"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, platformFee, payoutAmount } from "@/lib/pet/stripe";
import { bookingTotalCents } from "@/lib/pet/booking";

function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_PET_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

export async function createBooking(offeringId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/pet/reservation/${offeringId}`);
  }

  const offering = await prisma.petServiceOffering.findUnique({
    where: { id: offeringId },
    include: { proService: true },
  });
  if (!offering || !offering.isActive) throw new Error("Prestation indisponible");
  if (!offering.proService.isPublished || !offering.proService.kycCompletedAt) {
    throw new Error("Ce pet-sitter n'accepte pas encore de réservations");
  }
  if (offering.proService.userId === session.user.id) {
    throw new Error("Vous ne pouvez pas réserver votre propre prestation");
  }

  const startStr = String(formData.get("startDate") ?? "");
  const endStr = String(formData.get("endDate") ?? "");
  const petCount = Math.max(1, Math.min(offering.maxPets, Number(formData.get("petCount") ?? 1)));
  const petInfo = String(formData.get("petInfo") ?? "").trim() || null;

  const startDate = new Date(startStr);
  const endDate = new Date(endStr);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error("Dates invalides");
  }
  if (endDate <= startDate) throw new Error("La date de fin doit suivre la date de début");

  const totalCents = bookingTotalCents(offering.priceCents, offering.unit, startDate, endDate, petCount);
  const feeCents = platformFee(totalCents);
  const payoutCents = payoutAmount(totalCents);

  const booking = await prisma.petBooking.create({
    data: {
      proServiceId: offering.proServiceId,
      offeringId: offering.id,
      clientId: session.user.id,
      startDate,
      endDate,
      petCount,
      petInfo,
      totalCents,
      platformFeeCents: feeCents,
      proPayoutCents: payoutCents,
      status: "PENDING",
    },
  });

  // Escrow model: the client is charged on the platform account now. The
  // pet-sitter is paid out via a separate Stripe transfer only after the
  // service ends (see the daily release cron). No transfer_data here.
  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: totalCents,
          product_data: {
            name: offering.title,
            description: `${offering.proService.displayName} — du ${startDate.toLocaleDateString("fr-FR")} au ${endDate.toLocaleDateString("fr-FR")}`,
          },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      metadata: { petBookingId: booking.id },
    },
    metadata: { petBookingId: booking.id },
    success_url: appUrl(`/pet/reservation/confirmee?booking=${booking.id}`),
    cancel_url: appUrl(`/pet/reservation/${offering.id}?annule=1`),
    client_reference_id: booking.id,
  });

  await prisma.petPayment.create({
    data: {
      bookingId: booking.id,
      stripePaymentIntentId:
        typeof checkout.payment_intent === "string"
          ? checkout.payment_intent
          : `cs_${checkout.id}`,
      amountCents: totalCents,
      platformFeeCents: feeCents,
      status: "REQUIRES_PAYMENT",
    },
  });

  if (!checkout.url) throw new Error("Échec création paiement Stripe");
  redirect(checkout.url);
}

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/pet/stripe";

export const dynamic = "force-dynamic";

// Stripe webhook — requires the raw request body for signature verification.
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_PET_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `Signature verification failed: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const chargesEnabled = account.charges_enabled === true;
        const payoutsEnabled = account.payouts_enabled === true;
        const detailsSubmitted = account.details_submitted === true;

        const pro = await prisma.petProService.findUnique({
          where: { stripeAccountId: account.id },
          select: { id: true, kycCompletedAt: true, isPublished: true },
        });
        if (pro) {
          const kycDone = chargesEnabled && payoutsEnabled && detailsSubmitted;
          await prisma.petProService.update({
            where: { id: pro.id },
            data: {
              stripeChargesEnabled: chargesEnabled,
              stripePayoutsEnabled: payoutsEnabled,
              kycCompletedAt: kycDone ? pro.kycCompletedAt ?? new Date() : null,
              isPublished: chargesEnabled && payoutsEnabled ? pro.isPublished : false,
            },
          });
        }
        break;
      }

      case "checkout.session.completed": {
        const cs = event.data.object as Stripe.Checkout.Session;
        const bookingId = cs.metadata?.petBookingId;
        if (bookingId && cs.payment_status === "paid") {
          const paymentIntentId =
            typeof cs.payment_intent === "string" ? cs.payment_intent : null;
          await prisma.petPayment.updateMany({
            where: { bookingId },
            data: {
              status: "SUCCEEDED",
              capturedAt: new Date(),
              ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
            },
          });
          await prisma.petBooking.updateMany({
            where: { id: bookingId, status: "PENDING" },
            data: { status: "CONFIRMED" },
          });
        }
        break;
      }

      case "checkout.session.expired": {
        const cs = event.data.object as Stripe.Checkout.Session;
        const bookingId = cs.metadata?.petBookingId;
        if (bookingId) {
          await prisma.petPayment.updateMany({
            where: { bookingId, status: "REQUIRES_PAYMENT" },
            data: { status: "FAILED" },
          });
          await prisma.petBooking.updateMany({
            where: { id: bookingId, status: "PENDING" },
            data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Paiement abandonné" },
          });
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
        if (pi) {
          const payment = await prisma.petPayment.findUnique({
            where: { stripePaymentIntentId: pi },
            select: { bookingId: true },
          });
          if (payment) {
            await prisma.petPayment.update({
              where: { stripePaymentIntentId: pi },
              data: { status: "REFUNDED", refundedAt: new Date(), stripeChargeId: charge.id },
            });
            await prisma.petBooking.update({
              where: { id: payment.bookingId },
              data: { status: "REFUNDED" },
            });
          }
        }
        break;
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Handler failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}

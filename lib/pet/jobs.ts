import type { PrismaClient } from "@prisma/client";
import { stripe } from "./stripe";

// Releases escrowed funds to pet-sitters: for every confirmed booking whose
// service ended at least RELEASE_DELAY_HOURS ago, transfer the payout share
// (total minus the 10% platform commission) to the sitter's Stripe account.
const RELEASE_DELAY_HOURS = 24;

export async function runPayoutRelease(prisma: PrismaClient) {
  const cutoff = new Date(Date.now() - RELEASE_DELAY_HOURS * 3_600_000);

  const due = await prisma.petBooking.findMany({
    where: {
      status: { in: ["CONFIRMED", "IN_PROGRESS"] },
      endDate: { lte: cutoff },
      payment: { status: "SUCCEEDED" },
    },
    include: {
      payment: true,
      proService: { select: { stripeAccountId: true, stripePayoutsEnabled: true } },
    },
  });

  const results: { bookingId: string; status: string; detail?: string }[] = [];

  for (const booking of due) {
    const payment = booking.payment;
    const acct = booking.proService.stripeAccountId;

    if (!payment || !acct || !booking.proService.stripePayoutsEnabled) {
      results.push({ bookingId: booking.id, status: "skipped", detail: "compte Stripe non prêt" });
      continue;
    }

    try {
      // Resolve the underlying charge so the transfer is linked to the funds.
      let chargeId = payment.stripeChargeId;
      if (!chargeId) {
        const pi = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
        chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : null;
      }

      const transfer = await stripe.transfers.create(
        {
          amount: booking.proPayoutCents,
          currency: payment.currency,
          destination: acct,
          ...(chargeId ? { source_transaction: chargeId } : {}),
          metadata: { petBookingId: booking.id },
        },
        { idempotencyKey: `pet-payout-${booking.id}` },
      );

      await prisma.$transaction([
        prisma.petPayment.update({
          where: { id: payment.id },
          data: {
            status: "RELEASED",
            releasedAt: new Date(),
            stripeTransferId: transfer.id,
            stripeChargeId: chargeId,
          },
        }),
        prisma.petBooking.update({
          where: { id: booking.id },
          data: { status: "COMPLETED" },
        }),
      ]);

      results.push({ bookingId: booking.id, status: "released" });
    } catch (err) {
      results.push({ bookingId: booking.id, status: "error", detail: (err as Error).message });
    }
  }

  return {
    scanned: due.length,
    released: results.filter((r) => r.status === "released").length,
    results,
  };
}

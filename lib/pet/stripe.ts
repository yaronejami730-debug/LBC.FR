import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;

if (!key && process.env.NODE_ENV === "production") {
  throw new Error("STRIPE_SECRET_KEY is required in production");
}

export const stripe = new Stripe(key ?? "sk_test_placeholder", {
  typescript: true,
});

export const PLATFORM_FEE_BPS = 1000;

export function platformFee(totalCents: number): number {
  return Math.round((totalCents * PLATFORM_FEE_BPS) / 10000);
}

export function payoutAmount(totalCents: number): number {
  return totalCents - platformFee(totalCents);
}

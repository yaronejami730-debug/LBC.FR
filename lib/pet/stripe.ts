import Stripe from "stripe";

// Constructed with whatever key is present so module import never throws
// (a throw here would break `next build`). Stripe API calls fail with a clear
// auth error at request time if STRIPE_SECRET_KEY is missing or invalid.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  typescript: true,
});

export const PLATFORM_FEE_BPS = 1000;

export function platformFee(totalCents: number): number {
  return Math.round((totalCents * PLATFORM_FEE_BPS) / 10000);
}

export function payoutAmount(totalCents: number): number {
  return totalCents - platformFee(totalCents);
}

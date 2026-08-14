import Stripe from "stripe";

/**
 * Client Stripe de la régie.
 *
 * Ici, **Deal&Co est le vendeur** : elle vend de l'espace publicitaire, encaisse
 * sur son propre compte, et émet la facture. Aucun Stripe Connect, aucun compte
 * tiers — c'est l'inverse exact du paiement des professionnels, et c'est
 * pourquoi ce fichier est séparé de tout autre module Stripe du projet.
 *
 * Construit même sans clé pour qu'un import ne casse jamais le build ; l'appel
 * échoue proprement à l'exécution, et `isAdsStripeConfigured` permet à
 * l'interface de le dire avant d'essayer.
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  typescript: true,
});

export function isAdsStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function adsAppUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}${path}`;
}

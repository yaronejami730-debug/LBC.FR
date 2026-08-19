import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/ads/stripe";
import { creditTopUp } from "@/lib/ads/wallet";
import { resumeAdvertiserCampaigns } from "@/lib/ads/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook des recharges publicitaires.
 *
 * Endpoint distinct de celui du module Pet : deux flux d'argent différents,
 * deux secrets, deux journaux. Les mélanger obligerait chaque handler à
 * vérifier qu'un événement le concerne, et un oubli créditerait le mauvais
 * compte.
 *
 * Le retour du navigateur sur la page de succès ne crédite rien : seule cette
 * route, signée par Stripe, fait autorité.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_ADS_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[ads/webhook] STRIPE_ADS_WEBHOOK_SECRET absent");
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signature manquante" }, { status: 400 });

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    return NextResponse.json({ error: `Signature invalide : ${(err as Error).message}` }, { status: 400 });
  }

  // Journal partagé avec les autres webhooks Stripe : la clé primaire est
  // l'identifiant d'événement, donc un rejeu ne peut pas créditer deux fois.
  try {
    await prisma.adWebhookEvent.create({
      data: { id: event.id, type: event.type, livemode: event.livemode },
    });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const advertiserId = session.metadata?.dealco_advertiser_id;
      const kind = session.metadata?.dealco_kind;

      if (kind === "ads_topup" && advertiserId && session.payment_status === "paid") {
        const result = await creditTopUp({
          advertiserId,
          amountCentsTTC: session.amount_total ?? Number(session.metadata?.dealco_amount_ttc ?? 0),
          stripeSessionId: session.id,
        });
        // Une recharge ne sert à rien si les campagnes arrêtées faute de solde
        // restent arrêtées : la reprise fait partie du paiement, pas d'une
        // tâche de fond que l'annonceur devrait attendre.
        const resumed = result.credited ? await resumeAdvertiserCampaigns(advertiserId) : 0;
        console.info(
          "[ads/webhook] recharge",
          session.id,
          result.credited ? "créditée" : "déjà traitée",
          `campagnes relancées : ${resumed}`,
        );
      }
    }

    await prisma.adWebhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    });
  } catch (err) {
    console.error("[ads/webhook] traitement en échec", err);
    await prisma.adWebhookEvent.update({
      where: { id: event.id },
      data: { error: (err as Error).message.slice(0, 500) },
    });
    return NextResponse.json({ error: "Traitement en échec" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

import { NextResponse, type NextRequest } from "next/server";
import { requireActiveAdvertiser } from "@/lib/ads/advertiser-auth";
import { adsAppUrl, isAdsStripeConfigured, stripe } from "@/lib/ads/stripe";
import { MAX_TOPUP_CENTS, MIN_TOPUP_CENTS, VAT_RATE } from "@/lib/ads/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ouvre une page de paiement Stripe pour recharger le portefeuille.
 *
 * Le montant demandé est un montant **hors taxes** — c'est en HT que la
 * publicité se consomme. La TVA est ajoutée à l'affichage et au paiement, puis
 * séparée de nouveau à la facturation.
 */
export async function POST(req: NextRequest) {
  const advertiser = await requireActiveAdvertiser();
  if (!advertiser) return NextResponse.json({ error: "Session expirée." }, { status: 401 });

  if (!isAdsStripeConfigured()) {
    return NextResponse.json(
      { error: "Le paiement en ligne n'est pas encore ouvert. Votre interlocuteur Deal&Co peut créditer votre compte." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { amountCents?: unknown };
  const amountHT = Math.round(Number(body.amountCents) || 0);
  if (amountHT < MIN_TOPUP_CENTS || amountHT > MAX_TOPUP_CENTS) {
    return NextResponse.json(
      {
        error: `Montant compris entre ${MIN_TOPUP_CENTS / 100} € et ${MAX_TOPUP_CENTS / 100} € hors taxes.`,
      },
      { status: 400 },
    );
  }

  const amountTTC = Math.round(amountHT * (1 + VAT_RATE));

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: advertiser.email,
      client_reference_id: advertiser.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amountTTC,
            product_data: {
              name: "Crédit publicitaire Deal&Co Ads",
              description: `${(amountHT / 100).toFixed(2)} € HT + TVA ${Math.round(VAT_RATE * 100)} %`,
            },
          },
        },
      ],
      // Le webhook est la seule autorité : ces métadonnées lui disent quoi
      // créditer et à qui, sans jamais faire confiance au navigateur.
      metadata: {
        dealco_advertiser_id: advertiser.id,
        dealco_amount_ttc: String(amountTTC),
        dealco_kind: "ads_topup",
      },
      success_url: adsAppUrl("/annonceur/facturation?recharge=ok"),
      cancel_url: adsAppUrl("/annonceur/facturation?recharge=annulee"),
    });

    if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement");
    return NextResponse.json({ url: session.url, amountTTC });
  } catch (e) {
    console.error("[ads/recharge] échec", e);
    return NextResponse.json({ error: "Paiement indisponible pour le moment." }, { status: 502 });
  }
}

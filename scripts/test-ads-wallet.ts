/**
 * Vérifications du portefeuille et de la facturation, en base.
 *
 * Les autres suites sont pures ; celle-ci ne peut pas l'être. L'idempotence
 * d'une recharge, l'engagement d'un budget et le débit d'un événement reposent
 * sur des contraintes d'unicité et des transactions : les simuler en mémoire
 * reviendrait à tester une imitation, et c'est précisément ce qui laisse passer
 * les doubles crédits.
 *
 * **Elle écrit en base.** Tout ce qu'elle crée porte un préfixe reconnaissable
 * et est supprimé à la fin, y compris en cas d'échec. Elle refuse de démarrer
 * sans autorisation explicite, parce qu'une base de production n'est pas un
 * terrain de jeu :
 *
 *     ADS_TEST_WRITE=1 npx tsx -r ./scripts/load-env.ts scripts/test-ads-wallet.ts
 */
import { prisma } from "../lib/prisma";
import {
  campaignReservation,
  creditTopUp,
  debitForSpend,
  ledgerBalance,
  recordMovement,
  refundEvent,
  releaseCampaignBudget,
  reserveCampaignBudget,
  walletState,
  WalletError,
} from "../lib/ads/wallet";
import { chargeEvent, pauseAdvertiserCampaigns, resumeAdvertiserCampaigns } from "../lib/ads/billing";
import { check, equal, report, section } from "./test-helpers";

if (process.env.ADS_TEST_WRITE !== "1") {
  console.error(
    "Cette suite écrit en base. Relancez-la avec ADS_TEST_WRITE=1 si la base visée peut l'accepter.",
  );
  process.exit(2);
}

const TAG = `test-ads-${Date.now()}`;

async function main() {
  const advertiser = await prisma.advertiser.create({
    data: {
      firstName: "Test",
      lastName: "Portefeuille",
      email: `${TAG}@example.invalid`,
      loginId: TAG,
      passwordHash: "x",
      mustChangePassword: false,
    },
    select: { id: true },
  });

  const campaign = await prisma.adCampaign.create({
    data: {
      advertiserId: advertiser.id,
      name: `${TAG} campagne`,
      objective: "VISITES",
      status: "ACTIVE",
      startAt: new Date(Date.now() - 3600_000),
      endAt: new Date(Date.now() + 30 * 86_400_000),
      dailyBudgetCents: 2000,
      totalBudgetCents: 30_000,
      maxBidCents: 100,
      billingModel: "CPC",
      ads: {
        create: {
          title: "Créatif de test",
          description: "Ne doit jamais être diffusé.",
          imageUrl: "https://example.invalid/x.jpg",
          ctaLabel: "Voir",
          destinationUrl: "https://example.invalid",
          isActive: false,
        },
      },
    },
    select: { id: true, ads: { select: { id: true } } },
  });
  const adId = campaign.ads[0].id;

  // ── Recharge ─────────────────────────────────────────────────────────────
  section("Recharge");
  {
    const first = await creditTopUp({
      advertiserId: advertiser.id,
      amountCentsTTC: 60_000,
      stripeSessionId: `${TAG}-cs-1`,
    });
    equal("une recharge payée crédite le portefeuille", first.credited, true);
    // 600 € TTC à 20 % de TVA font 500 € hors taxes : c'est en HT que la
    // publicité se consomme.
    equal("le portefeuille est crédité du montant hors taxes", first.balanceCents, 50_000);

    const replay = await creditTopUp({
      advertiserId: advertiser.id,
      amountCentsTTC: 60_000,
      stripeSessionId: `${TAG}-cs-1`,
    });
    equal("le même paiement rejoué ne crédite pas deux fois", replay.credited, false);

    const state = await walletState(advertiser.id);
    equal("le solde n'a pas bougé au second passage", state?.balanceCents, 50_000);

    const invoices = await prisma.adInvoice.count({ where: { advertiserId: advertiser.id } });
    equal("une seule facture est émise", invoices, 1);
  }

  // ── Engagement ───────────────────────────────────────────────────────────
  section("Engagement d'un budget");
  {
    await reserveCampaignBudget({
      advertiserId: advertiser.id,
      campaignId: campaign.id,
      amountCents: 30_000,
      label: "Budget engagé — test",
    });

    const state = await walletState(advertiser.id);
    equal("le solde reste intact : engager n'est pas dépenser", state?.balanceCents, 50_000);
    equal("le budget engagé est réservé", state?.reservedCents, 30_000);
    equal("le diffusable est le solde moins l'engagé", state?.availableCents, 20_000);

    // Une seconde campagne de 300 € ne tient pas dans les 200 € restants :
    // c'est exactement le scénario que la réservation existe pour empêcher.
    let refused = false;
    try {
      await reserveCampaignBudget({
        advertiserId: advertiser.id,
        campaignId: `${campaign.id}-bis`,
        amountCents: 30_000,
        label: "Seconde campagne — test",
      });
    } catch (e) {
      refused = e instanceof WalletError;
    }
    equal("deux campagnes ne peuvent pas se partager le même argent", refused, true);

    // Rejouer la même demande ne double pas l'engagement — et ne doit surtout
    // pas être refusée pour « portefeuille insuffisant » : c'est le cas d'une
    // campagne relancée, dont le budget est déjà engagé.
    await reserveCampaignBudget({
      advertiserId: advertiser.id,
      campaignId: campaign.id,
      amountCents: 30_000,
      label: "Budget engagé — test",
    });
    const again = await walletState(advertiser.id);
    equal("réserver deux fois la même campagne n'engage qu'une fois", again?.reservedCents, 30_000);
    equal("et l'engagement de la campagne est lisible au journal", await campaignReservation(campaign.id), 30_000);

    // Relever le budget d'une campagne n'engage que la différence.
    await reserveCampaignBudget({
      advertiserId: advertiser.id,
      campaignId: campaign.id,
      amountCents: 35_000,
      label: "Budget relevé — test",
    });
    const raised = await walletState(advertiser.id);
    equal("relever le budget n'engage que la différence", raised?.reservedCents, 35_000);
    await releaseCampaignBudget({
      advertiserId: advertiser.id,
      campaignId: campaign.id,
      amountCents: 5000,
      label: "Retour au budget initial — test",
    });
    equal("et le désengagement se fait au même endroit", (await walletState(advertiser.id))?.reservedCents, 30_000);
  }

  // ── Dépense ──────────────────────────────────────────────────────────────
  section("Dépense d'un événement");
  {
    const event = await prisma.adEvent.create({
      data: {
        type: "CLICK",
        campaignId: campaign.id,
        adId,
        placement: "HOME_TOP",
        dedupKey: `${TAG}-click-1`,
        priceCents: 63,
        bidCents: 100,
        validationStatus: "VALID",
      },
      select: { id: true },
    });

    const result = await chargeEvent({ campaignId: campaign.id, adEventId: event.id, costCents: 63 });
    equal("le clic est facturé au prix de l'enchère", result.costCents, 63);

    const state = await walletState(advertiser.id);
    equal("le portefeuille est débité", state?.balanceCents, 50_000 - 63);
    equal("l'engagement diminue d'autant", state?.reservedCents, 30_000 - 63);

    // Idempotence : le même événement ne peut pas être débité deux fois, même
    // si la route est rejouée ou si deux instances traitent la même requête.
    const replay = await debitForSpend({
      advertiserId: advertiser.id,
      campaignId: campaign.id,
      adEventId: event.id,
      costCents: 63,
      label: "Rejeu",
    });
    equal("un même événement ne débite qu'une fois", replay?.applied, false);

    const after = await walletState(advertiser.id);
    equal("le solde n'a pas rebougé", after?.balanceCents, 50_000 - 63);

    const movement = await prisma.adWalletTransaction.findFirst({
      where: { adEventId: event.id, type: "SPEND" },
      select: { balanceBeforeCents: true, balanceAfterCents: true, amountCents: true },
    });
    check(
      "le mouvement porte le solde d'avant et d'après",
      movement?.balanceBeforeCents === 50_000 &&
        movement?.balanceAfterCents === 50_000 - 63 &&
        movement?.amountCents === -63,
    );

    // Remboursement d'un événement reconnu frauduleux après coup.
    await refundEvent({
      advertiserId: advertiser.id,
      campaignId: campaign.id,
      adEventId: event.id,
      costCents: 63,
      label: "Clic invalidé après contrôle",
    });
    const refunded = await walletState(advertiser.id);
    equal("un remboursement rend l'argent", refunded?.balanceCents, 50_000);

    const lines = await prisma.adWalletTransaction.count({
      where: { adEventId: event.id },
    });
    equal("les deux lignes restent au journal", lines, 2);
  }

  // ── Le journal fait foi ──────────────────────────────────────────────────
  section("Cohérence du journal");
  {
    const state = await walletState(advertiser.id);
    const ledger = await ledgerBalance(advertiser.id);
    equal("le cumul des mouvements égale le solde affiché", ledger, state?.balanceCents);
  }

  // ── Solde épuisé ─────────────────────────────────────────────────────────
  section("Portefeuille épuisé");
  {
    await recordMovement({
      advertiserId: advertiser.id,
      type: "ADJUSTMENT",
      amountCents: -50_000,
      label: "Vidage pour test",
      idempotencyKey: `${TAG}-drain`,
    });

    const paused = await pauseAdvertiserCampaigns(advertiser.id);
    check("les campagnes s'arrêtent quand le portefeuille est vide", paused >= 1);

    const stopped = await prisma.adCampaign.findUniqueOrThrow({
      where: { id: campaign.id },
      select: { status: true },
    });
    equal("le statut le dit explicitement", stopped.status, "PAUSED_INSUFFICIENT_FUNDS");

    await creditTopUp({
      advertiserId: advertiser.id,
      amountCentsTTC: 12_000,
      stripeSessionId: `${TAG}-cs-2`,
    });
    const resumed = await resumeAdvertiserCampaigns(advertiser.id);
    check("une recharge relance la diffusion", resumed >= 1);

    const restarted = await prisma.adCampaign.findUniqueOrThrow({
      where: { id: campaign.id },
      select: { status: true },
    });
    equal("la campagne repart", restarted.status, "ACTIVE");
  }

  // ── Plafond du jour ──────────────────────────────────────────────────────
  section("Plafond quotidien");
  {
    const event = await prisma.adEvent.create({
      data: {
        type: "CLICK",
        campaignId: campaign.id,
        adId,
        placement: "HOME_TOP",
        dedupKey: `${TAG}-click-cap`,
        priceCents: 2500,
        validationStatus: "VALID",
      },
      select: { id: true },
    });

    // 25 € en une fois sur un plafond de 20 € par jour : la campagne doit
    // s'arrêter d'elle-même jusqu'à demain.
    const result = await chargeEvent({
      campaignId: campaign.id,
      adEventId: event.id,
      costCents: 2500,
    });
    equal("le plafond du jour arrête la diffusion", result.stopped, "PAUSED_BUDGET");

    const capped = await prisma.adCampaign.findUniqueOrThrow({
      where: { id: campaign.id },
      select: { status: true, dailyCapAt: true },
    });
    equal("le statut distingue le plafond d'une pause décidée", capped.status, "PAUSED_BUDGET");
    check("l'instant du plafond est conservé", capped.dailyCapAt !== null);
  }

  // ── Libération ───────────────────────────────────────────────────────────
  section("Libération de l'engagement");
  {
    // Libérer plus que ce qui était engagé prendrait sur les autres campagnes.
    await releaseCampaignBudget({
      advertiserId: advertiser.id,
      campaignId: campaign.id,
      amountCents: 999_999,
      label: "Libération excessive — test",
    });
    equal(
      "une libération excessive est plafonnée à l'engagement réel",
      await campaignReservation(campaign.id),
      0,
    );

    const before = await walletState(advertiser.id);
    await releaseCampaignBudget({
      advertiserId: advertiser.id,
      campaignId: campaign.id,
      amountCents: before?.reservedCents ?? 0,
      label: "Fin de campagne — test",
    });
    const after = await walletState(advertiser.id);
    equal("plus rien n'est engagé", after?.reservedCents, 0);
    equal("et le solde n'a pas bougé : libérer n'est pas créditer", after?.balanceCents, before?.balanceCents);
  }
}

/** Nettoyage : rien de ce que cette suite crée ne doit survivre. */
async function cleanup() {
  const advertiser = await prisma.advertiser.findUnique({
    where: { loginId: TAG },
    select: { id: true },
  });
  if (!advertiser) return;
  // Les campagnes, créatifs, événements, mouvements et factures partent en
  // cascade avec l'annonceur — sauf les événements, rattachés à la campagne.
  await prisma.adCampaign.deleteMany({ where: { advertiserId: advertiser.id } });
  await prisma.advertiser.delete({ where: { id: advertiser.id } });
}

main()
  .then(cleanup)
  .then(() => report("Portefeuille et facturation"))
  .catch(async (e) => {
    console.error(e);
    await cleanup().catch(() => null);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

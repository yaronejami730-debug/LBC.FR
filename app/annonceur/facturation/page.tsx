import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireActiveAdvertiser } from "@/lib/ads/advertiser-auth";
import { isAdsStripeConfigured } from "@/lib/ads/stripe";
import AdvertiserShell, { COLORS } from "../AdvertiserShell";
import RechargePanel from "./RechargePanel";

export const dynamic = "force-dynamic";

const euros = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const dt = (d: Date) =>
  d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

const TYPE_LABEL: Record<string, string> = {
  RECHARGE: "Recharge",
  SPEND: "Diffusion",
  REFUND: "Remboursement",
  ADJUSTMENT: "Ajustement",
};

/**
 * Budget et facturation.
 *
 * Le solde est prépayé : ce qui est affiché ici est ce qui reste réellement à
 * dépenser, et l'historique explique chaque euro. Une régie doit pouvoir
 * répondre à « d'où vient ce montant » ligne par ligne.
 */
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ recharge?: string }>;
}) {
  const advertiser = await requireActiveAdvertiser();
  if (!advertiser) redirect("/annonceur/connexion");
  if (advertiser.mustChangePassword) redirect("/annonceur/mot-de-passe");

  const { recharge } = await searchParams;

  const [transactions, invoices, spentThisMonth] = await Promise.all([
    prisma.adWalletTransaction.findMany({
      where: { advertiserId: advertiser.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.adInvoice.findMany({
      where: { advertiserId: advertiser.id },
      orderBy: { issuedAt: "desc" },
      take: 20,
    }),
    prisma.adWalletTransaction.aggregate({
      where: {
        advertiserId: advertiser.id,
        type: "SPEND",
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
      _sum: { amountCents: true },
    }),
  ]);

  const card = "rounded-[18px] bg-white p-[18px]";
  const cardStyle = { border: `1px solid ${COLORS.line}` };

  return (
    <AdvertiserShell
      title="Budget et facturation"
      subtitle="Votre crédit publicitaire, et ce qu'il finance."
      advertiserName={advertiser.company || `${advertiser.firstName} ${advertiser.lastName}`}
      contactName={`${advertiser.firstName} ${advertiser.lastName}`}
      current="/annonceur/facturation"
    >
      <div className="flex flex-col gap-5 max-w-4xl">
        {recharge === "ok" && (
          <p className="rounded-[18px] px-4 py-3 text-[13px] font-semibold" style={{ background: "#DCFCE7", color: "#15803D" }}>
            Paiement reçu. Votre solde est crédité dès la confirmation de Stripe — quelques secondes,
            le temps que la banque réponde.
          </p>
        )}
        {recharge === "annulee" && (
          <p className="rounded-[18px] px-4 py-3 text-[13px] font-semibold" style={{ background: COLORS.tint, color: COLORS.soft }}>
            Recharge annulée. Rien n&apos;a été débité.
          </p>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className={card} style={cardStyle}>
            <p className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: COLORS.muted }}>
              Solde disponible
            </p>
            <p className="mt-1.5 text-[28px] font-extrabold tabular-nums leading-none">
              {euros(advertiser.balanceCents)}
            </p>
            <p className="mt-1 text-[12px]" style={{ color: COLORS.muted }}>
              Hors taxes, dépensable immédiatement.
            </p>
          </div>
          <div className={card} style={cardStyle}>
            <p className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: COLORS.muted }}>
              Dépensé ce mois
            </p>
            <p className="mt-1.5 text-[28px] font-extrabold tabular-nums leading-none">
              {euros(Math.abs(spentThisMonth._sum.amountCents ?? 0))}
            </p>
          </div>
          <div className={card} style={cardStyle}>
            <p className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: COLORS.muted }}>
              Factures
            </p>
            <p className="mt-1.5 text-[28px] font-extrabold tabular-nums leading-none">{invoices.length}</p>
          </div>
        </section>

        {/* Solde à zéro : la diffusion est à l'arrêt, il faut le dire avant que
            l'annonceur ne s'en aperçoive dans ses chiffres. */}
        {advertiser.balanceCents <= 0 && (
          <p className="rounded-[18px] px-4 py-3 text-[13px] font-semibold" style={{ background: "#FEF3C7", color: "#B45309" }}>
            Votre solde est épuisé : vos campagnes ne sont plus diffusées. Rechargez pour les
            relancer — elles repartent sans autre manipulation.
          </p>
        )}

        <section className={card} style={cardStyle}>
          <h2 className="font-extrabold text-[15px]">Recharger mon compte</h2>
          <RechargePanel configured={isAdsStripeConfigured()} />
        </section>

        <section className={`${card} p-0 overflow-hidden`} style={cardStyle}>
          <div className="px-[18px] py-4" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
            <h2 className="font-extrabold text-[15px]">Historique</h2>
          </div>
          {transactions.length === 0 ? (
            <p className="px-[18px] py-8 text-center text-[13px]" style={{ color: COLORS.muted }}>
              Aucun mouvement pour l&apos;instant.
            </p>
          ) : (
            <ul className="divide-y" style={{ borderColor: COLORS.line }}>
              {transactions.map((tx) => (
                <li key={tx.id} className="px-[18px] py-3 flex items-center gap-4">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-[13.5px] truncate">{tx.label}</span>
                    <span className="block text-[11.5px]" style={{ color: COLORS.muted }}>
                      {TYPE_LABEL[tx.type] ?? tx.type} · {dt(tx.createdAt)}
                    </span>
                  </span>
                  <span
                    className="shrink-0 text-[13.5px] font-bold tabular-nums"
                    style={{ color: tx.amountCents >= 0 ? "#15803D" : COLORS.ink }}
                  >
                    {tx.amountCents >= 0 ? "+" : "−"}
                    {euros(Math.abs(tx.amountCents))}
                  </span>
                  <span className="w-24 shrink-0 text-right text-[12px] tabular-nums" style={{ color: COLORS.muted }}>
                    {euros(tx.balanceAfterCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {invoices.length > 0 && (
          <section className={`${card} p-0 overflow-hidden`} style={cardStyle}>
            <div className="px-[18px] py-4" style={{ borderBottom: `1px solid ${COLORS.line}` }}>
              <h2 className="font-extrabold text-[15px]">Factures</h2>
            </div>
            <ul className="divide-y" style={{ borderColor: COLORS.line }}>
              {invoices.map((inv) => (
                <li key={inv.id} className="px-[18px] py-3 flex items-center gap-4 text-[13.5px]">
                  <span className="font-mono font-bold">{inv.number}</span>
                  <span style={{ color: COLORS.muted }}>{dt(inv.issuedAt)}</span>
                  <span className="flex-1" />
                  <span className="tabular-nums" style={{ color: COLORS.muted }}>
                    {euros(inv.amountCentsHT)} HT
                  </span>
                  <span className="tabular-nums font-bold">{euros(inv.amountCentsTTC)} TTC</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AdvertiserShell>
  );
}

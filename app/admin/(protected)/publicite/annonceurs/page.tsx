import { prisma } from "@/lib/prisma";
import AdvertisersManager from "./AdvertisersManager";

export const metadata = { title: "Annonceurs — Deal&Co Ads" };
export const dynamic = "force-dynamic";

/**
 * Annonceurs de la régie.
 *
 * L'écran ne montre jamais de mot de passe : la base n'en garde que
 * l'empreinte. Un accès perdu se régénère, il ne se relit pas — c'est dit à
 * l'écran pour éviter la question.
 */
export default async function AdminAdvertisersPage() {
  const advertisers = await prisma.advertiser.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      company: true,
      siret: true,
      loginId: true,
      mustChangePassword: true,
      suspendedAt: true,
      billingDisabledAt: true,
      balanceCents: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2f6fb8]">
          Publicité
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Annonceurs</h1>
        <p className="text-sm text-slate-500 mt-1">
          Créez un compte, l&apos;annonceur reçoit ses accès par e-mail et choisit son mot de passe
          à la première connexion.
        </p>
      </header>

      <AdvertisersManager
        initial={advertisers.map((a) => ({
          ...a,
          suspendedAt: a.suspendedAt?.toISOString() ?? null,
          billingDisabledAt: a.billingDisabledAt?.toISOString() ?? null,
          lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
          createdAt: a.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}

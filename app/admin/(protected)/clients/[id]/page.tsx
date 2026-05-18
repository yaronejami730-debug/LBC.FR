import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getClientListings } from "@/app/admin/actions";
import ClientListingsPanel from "./ClientListingsPanel";
import DisplayNameEditor from "./DisplayNameEditor";
import ConsentReminderButton from "./ConsentReminderButton";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      isPro: true,
      companyName: true,
      siret: true,
      verified: true,
      lastLoginAt: true,
      createdAt: true,
      consentGivenAt: true,
      bannedAt: true,
      // Compte uniquement les annonces non supprimées — sinon le total reste
      // figé après une suppression depuis le CRM.
      _count: { select: { listings: { where: { deletedAt: null } } } },
    },
  });
  if (!user) notFound();

  const listings = await getClientListings(id);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[#777683]">
        <Link href="/admin/create-client" className="hover:text-[#2f6fb8] transition-colors">
          Clients
        </Link>
        <span>/</span>
        <span className="text-[#191c1e] font-semibold">{user.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-[#eceef0] p-6">
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 rounded-full bg-[#e1e0ff] flex items-center justify-center flex-shrink-0">
            <span className="text-[#2f6fb8] text-xl font-extrabold">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-extrabold text-[#191c1e] font-headline truncate">
              {user.name}
            </h1>
            <p className="text-sm text-[#777683] truncate">{user.email}</p>
            <div className="flex flex-wrap gap-2 mt-3 text-xs">
              {user.isPro && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#e8f0fb] text-[#2f6fb8] font-semibold">
                  <span className="material-symbols-outlined text-[14px]">business_center</span>
                  Pro {user.companyName ? `· ${user.companyName}` : ""}
                  {user.siret ? ` · SIRET ${user.siret}` : ""}
                </span>
              )}
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold ${
                user.lastLoginAt
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}>
                <span className="material-symbols-outlined text-[14px]">
                  {user.lastLoginAt ? "check_circle" : "schedule"}
                </span>
                {user.lastLoginAt ? "Activé" : "Pas encore activé"}
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold ${
                user.consentGivenAt
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
              }`}>
                <span className="material-symbols-outlined text-[14px]">verified_user</span>
                CGU {user.consentGivenAt ? "acceptées" : "en attente"}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-semibold">
                {user._count.listings} annonce{user._count.listings !== 1 ? "s" : ""}
              </span>
            </div>
            {user.isPro && (
              <DisplayNameEditor userId={user.id} initialName={user.companyName} />
            )}

            <div className="mt-3">
              <ConsentReminderButton
                userId={user.id}
                consentGiven={Boolean(user.consentGivenAt)}
                banned={Boolean(user.bannedAt)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Listings */}
      <div>
        <h2 className="text-lg font-extrabold text-[#191c1e] font-headline mb-3">
          Annonces publiées
        </h2>
        {listings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#eceef0] py-16 text-center">
            <span className="material-symbols-outlined text-5xl text-[#c7c5d4]">inbox</span>
            <p className="text-[#777683] mt-2 text-sm">
              Aucune annonce publiée pour ce client.
            </p>
          </div>
        ) : (
          <ClientListingsPanel
            listings={listings}
            user={{
              name: user.name,
              isPro: user.isPro,
              companyName: user.companyName,
            }}
          />
        )}
      </div>
    </div>
  );
}

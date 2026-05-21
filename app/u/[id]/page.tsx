import { cache } from "react";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { getUserResponseTime } from "@/lib/user-stats";
import ListingCard from "@/components/home/ListingCard";

const BASE = "https://www.dealandcompany.fr";

const getUserWithListings = cache((id: string) =>
  prisma.user.findUnique({
    where: { id },
    include: {
      listings: {
        where: { deletedAt: null, status: "APPROVED" } as any,
        orderBy: { createdAt: "desc" },
      },
    },
  }).catch(() => null),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await getUserWithListings(id);
  if (!user) return {};
  const displayName = (user as any).isPro
    ? (user as any).companyName || user.name
    : user.name;
  const count = (user as any).listings?.length ?? 0;
  const url = `${BASE}/u/${id}`;
  const title = count > 0
    ? `${displayName} — ${count} annonce${count > 1 ? "s" : ""} sur Deal&Co`
    : `${displayName} — Profil vendeur sur Deal&Co`;
  const description = count > 0
    ? `Toutes les annonces de ${displayName} (${count}) sur Deal&Co — petites annonces gratuites entre particuliers en France.`
    : `Profil de ${displayName} sur Deal&Co, site de petites annonces gratuites en France.`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Deal&Co",
      type: "profile",
      locale: "fr_FR",
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = (await getUserWithListings(id)) as any;
  if (!user) notFound();

  const responseTime = await getUserResponseTime(user.id);

  const initials = (user.name as string)
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const displayName = user.isPro ? user.companyName || user.name : user.name;
  const profileUrl = `${BASE}/u/${user.id}`;
  const profileLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": user.isPro ? "Organization" : "Person",
      name: displayName,
      url: profileUrl,
      ...(user.avatar ? { image: user.avatar } : {}),
    },
  };
  const itemListLd = user.listings.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Annonces de ${displayName}`,
    numberOfItems: user.listings.length,
    itemListElement: user.listings.slice(0, 20).map((l: any, i: number) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE}${listingUrl(l.id, l.title)}`,
      name: l.title,
    })),
  } : null;

  return (
    <div className="bg-surface text-on-surface min-h-screen mb-24 md:mb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(profileLd) }}
      />
      {itemListLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
        />
      )}
      <Navbar active="" />

      <main className="pt-32 pb-10 px-6 max-w-3xl mx-auto">
        <div className="bg-white rounded-3xl p-8 shadow-[0_16px_48px_rgba(21,21,125,0.08)] mb-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-surface-container flex items-center justify-center mb-4 border-4 border-white shadow-lg">
              {user.avatar ? (
                <img className="w-full h-full object-cover" alt={user.name} src={user.avatar} />
              ) : (
                <span className="text-2xl font-bold text-outline">{initials}</span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-[#2f6fb8] font-['Manrope']">{user.name}</h1>
            {user.verified && (
              <div className="flex items-center gap-1.5 text-[#00a67e] font-bold text-xs mt-2 bg-[#e6fcf5] px-3 py-1 rounded-full uppercase tracking-wider">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                Vendeur vérifié
              </div>
            )}
            
            <div className={`grid ${responseTime ? "grid-cols-2" : "grid-cols-1"} gap-4 w-full mt-8`}>
              {responseTime && (
                <div className="bg-slate-50 p-4 rounded-2xl text-center">
                  <span className="block text-outline text-[10px] uppercase font-bold tracking-widest mb-1">Temps de réponse</span>
                  <span className="text-[#2f6fb8] font-bold text-lg">{responseTime}</span>
                </div>
              )}
              <div className="bg-slate-50 p-4 rounded-2xl text-center">
                <span className="block text-outline text-[10px] uppercase font-bold tracking-widest mb-1">Membre depuis</span>
                <span className="text-[#2f6fb8] font-bold text-lg">{user.memberSince}</span>
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-extrabold text-[#2f6fb8] font-['Manrope'] mb-6 flex items-center gap-2">
          Annonces en ligne
          <span className="text-sm font-medium text-outline">({user.listings.length})</span>
        </h2>

        {user.listings.length === 0 ? (
          <div className="bg-slate-50 rounded-2xl p-12 text-center border-2 border-dashed border-slate-200">
            <span className="material-symbols-outlined text-4xl text-outline/30 block mb-3">inventory_2</span>
            <p className="text-on-surface-variant font-medium">Aucune annonce en ligne pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
            {user.listings.map((listing: any) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </main>

      <BottomNav active="" />
    </div>
  );
}

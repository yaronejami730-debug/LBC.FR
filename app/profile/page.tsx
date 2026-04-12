import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "@/lib/utils";
import SignOutButton from "./SignOutButton";
import AvatarUpload from "./AvatarUpload";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/profile");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      listings: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) redirect("/login");

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="bg-surface text-on-surface min-h-screen mb-24 md:mb-0">
      <Navbar active="profil" right={<SignOutButton />} />

      <main className="pt-36 pb-10 px-6 max-w-3xl mx-auto">
        {/* Profile card */}
        <div className="bg-white rounded-2xl p-6 shadow-[0_4px_24px_rgba(21,21,125,0.06)] flex items-center gap-5 mb-8">
          <AvatarUpload currentAvatar={user.avatar} initials={initials} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-extrabold text-on-surface font-['Manrope'] truncate">{user.name}</h2>
              {user.verified && (
                <span className="flex items-center gap-1 bg-tertiary-container text-on-tertiary-container text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                  <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  Vérifié
                </span>
              )}
            </div>
            <p className="text-outline text-sm mt-0.5 truncate">{user.email}</p>
            <p className="text-outline/70 text-xs mt-1">Membre depuis {user.memberSince}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white rounded-xl p-4 text-center shadow-[0_2px_12px_rgba(21,21,125,0.05)]">
            <p className="text-2xl font-extrabold text-primary font-['Manrope']">{user.listings.length}</p>
            <p className="text-outline text-xs mt-0.5">Annonces</p>
          </div>
          <div className="bg-white rounded-xl p-4 text-center shadow-[0_2px_12px_rgba(21,21,125,0.05)]">
            <Link href="/messages" className="block">
              <p className="text-2xl font-extrabold text-primary font-['Manrope']">
                <span className="material-symbols-outlined text-2xl">chat</span>
              </p>
              <p className="text-outline text-xs mt-0.5">Messages</p>
            </Link>
          </div>
          <div className="bg-white rounded-xl p-4 text-center shadow-[0_2px_12px_rgba(21,21,125,0.05)]">
            <p className="text-2xl font-extrabold text-primary font-['Manrope']">{user.memberSince}</p>
            <p className="text-outline text-xs mt-0.5">Depuis</p>
          </div>
        </div>

        {/* My listings */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-extrabold text-on-surface font-['Manrope']">Mes annonces</h3>
          <Link href="/post" className="flex items-center gap-1 text-primary text-sm font-semibold">
            <span className="material-symbols-outlined text-base">add</span>
            Nouvelle annonce
          </Link>
        </div>

        {user.listings.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-[0_2px_12px_rgba(21,21,125,0.05)]">
            <span className="material-symbols-outlined text-4xl text-outline/40 block mb-3">sell</span>
            <p className="text-on-surface-variant font-medium">Vous n&apos;avez pas encore d&apos;annonces</p>
            <Link
              href="/post"
              className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-full font-bold text-sm shadow-md shadow-primary/20 active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Déposer une annonce
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {user.listings.map((listing) => {
              const images = JSON.parse(listing.images) as string[];
              const img = images[0] || "";
              return (
                <Link
                  key={listing.id}
                  href={`/listing/${listing.id}`}
                  className="group flex flex-col bg-white rounded-xl overflow-hidden border border-surface-container hover:shadow-md transition-all duration-200"
                >
                  <div className="relative aspect-square overflow-hidden bg-surface-container-low">
                    {img ? (
                      <img
                        src={img}
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl text-outline/30">image</span>
                      </div>
                    )}
                    {listing.isPremium && (
                      <span className="absolute top-2 left-2 bg-secondary-container text-on-secondary-container text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Premium
                      </span>
                    )}
                    {listing.status === "PENDING" && (
                      <span className="absolute top-2 right-2 bg-amber-100 text-amber-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        En attente
                      </span>
                    )}
                    {listing.status === "REJECTED" && (
                      <span className="absolute top-2 right-2 bg-red-100 text-red-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Refusée
                      </span>
                    )}
                  </div>
                  <div className="p-2.5 flex flex-col gap-0.5">
                    <p className="text-on-surface font-semibold text-sm leading-snug line-clamp-2">{listing.title}</p>
                    <p className="text-primary font-bold text-base mt-1">{listing.price.toLocaleString("fr-FR")} €</p>
                    <p className="text-outline text-xs truncate">{listing.location}</p>
                    <p className="text-outline/70 text-[10px]">{formatDistanceToNow(listing.createdAt)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav active="profil" />
    </div>
  );
}

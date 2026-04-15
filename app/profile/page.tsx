import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import SignOutButton from "./SignOutButton";
import AvatarUpload from "./AvatarUpload";
import UpgradePro from "./UpgradePro";
import ProBadge from "@/components/ProBadge";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import ProfileTabs from "./ProfileTabs";

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
      apiKeys: {
        where: { revokedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { keyPrefix: true, createdAt: true },
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
              <h2 className="text-xl font-extrabold text-on-surface font-['Manrope'] truncate">
                {user.isPro ? user.companyName : user.name}
              </h2>
              {user.isPro && <ProBadge size="sm" />}
              {user.verified && (
                <span className="flex items-center gap-1 bg-tertiary-container text-on-tertiary-container text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                  <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  Vérifié
                </span>
              )}
            </div>
            {user.isPro && <p className="text-outline text-sm mt-0.5 truncate">{user.name}</p>}
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

        {/* Upgrade Pro — visible si pas encore Pro */}
        {!user.isPro && (() => {
          const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const recentListings = user.listings.filter(
            (l) => new Date(l.createdAt) > oneWeekAgo
          ).length;
          // Propose Pro si 20+ annonces récentes, sinon section discrète
          if (recentListings >= 20) {
            return (
              <div className="bg-[#d5e3fc]/40 border border-[#d5e3fc] rounded-2xl p-5 mb-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-primary">trending_up</span>
                </div>
                <div className="flex-1">
                  <p className="font-extrabold text-on-surface font-['Manrope'] text-sm">
                    Vous êtes très actif sur Deal&nbsp;&amp;&nbsp;Co !
                  </p>
                  <p className="text-outline text-xs mt-1 leading-relaxed">
                    Vous avez publié <strong>{recentListings} annonces</strong> cette semaine.
                    Passez en compte Pro pour afficher votre badge et gagner en crédibilité.
                  </p>
                </div>
              </div>
            );
          }
          return null;
        })()}
        {!user.isPro && <UpgradePro />}

        {/* Clé API — pros uniquement */}
        {user.isPro && (
          <Link
            href="/profile/api-key"
            className="flex items-center gap-3 bg-white rounded-2xl border border-[#eceef0] px-5 py-4 hover:border-[#2f6fb8] hover:shadow-[0_0_0_3px_rgba(47,111,184,0.08)] transition-all group"
          >
            <span className="w-9 h-9 rounded-xl bg-[#2f6fb8]/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[#2f6fb8] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>api</span>
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800">Clé API</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {(user as any).apiKeys?.length > 0 ? "Clé active — cliquer pour gérer" : "Aucune clé — cliquer pour en créer une"}
              </p>
            </div>
            <span className="material-symbols-outlined text-slate-400 group-hover:text-[#2f6fb8] transition-colors text-[20px]">chevron_right</span>
          </Link>
        )}

        <ProfileTabs listings={user.listings} />
      </main>

      <BottomNav active="profil" />
    </div>
  );
}

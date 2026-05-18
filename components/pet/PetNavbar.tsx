import Link from "next/link";
import { auth } from "@/lib/auth";
import UserDropdown from "@/components/UserDropdown";

const NAV = [
  { label: "Trouver un pet-sitter", href: "/pet/recherche?service=garde" },
  { label: "Devenir pet-sitter", href: "/pet/compte-pro" },
  { label: "Comment ça marche", href: "/pet/comment-ca-marche" },
];

export default async function PetNavbar() {
  const session = await auth();
  const user = session?.user;

  let isPro = false;
  if (user?.id) {
    const { prisma } = await import("@/lib/prisma");
    const dbUser = await prisma.user
      .findUnique({ where: { id: user.id }, select: { isPro: true } })
      .catch(() => null);
    isPro = dbUser?.isPro ?? false;
  }

  return (
    <nav className="fixed top-0 w-full z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="w-full max-w-[1248px] mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between py-3 gap-4 lg:gap-8 min-h-[72px]">
          <div className="flex items-center gap-2">
            <Link href="/pet" title="Accueil Deal&Co Pet" className="flex items-center gap-2">
              <img src="/logo.png" alt="Deal&Co" className="w-44 h-auto" />
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2f6fb8]/10 text-[#2f6fb8] text-[11px] font-bold uppercase tracking-wider font-['Manrope']">
                <span className="material-symbols-outlined text-[13px]">pets</span>
                Pet
              </span>
            </Link>
          </div>

          <ul className="hidden lg:flex items-center gap-6 text-[14px] text-slate-600 font-medium">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="hover:text-[#2f6fb8] hover:underline transition-colors">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>

          <Link
            href="/pet/compte-pro"
            title="Proposer mes services de pet-sitting"
            className="hidden lg:flex items-center gap-2 bg-[#2f6fb8] hover:bg-[#2560a0] text-white px-4 py-2 rounded-full font-bold text-sm transition-colors flex-shrink-0 whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Proposer mes services
          </Link>

          <div className="flex items-center gap-4 lg:gap-6 flex-shrink-0">
            <UserDropdown user={user} isPro={isPro} />
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-6 py-2.5 text-[13px] text-slate-500 border-t border-slate-100">
          <Link href="/" className="hover:text-[#2f6fb8] transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Deal&amp;Co marketplace
          </Link>
          <span className="text-slate-300">·</span>
          <span className="text-slate-400">Vous êtes sur Deal&amp;Co Pet — service de mise en relation animaux</span>
        </div>
      </div>
    </nav>
  );
}

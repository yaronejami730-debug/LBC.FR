import { auth } from "@/lib/auth";
import Link from "next/link";
import CategoryDrawer from "./CategoryDrawer";
import UserDropdown from "./UserDropdown";
import NavSearch from "./NavSearch";

const CATEGORIES = [
  { label: "Immobilier",           href: "/search?category=Immobilier" },
  { label: "Véhicules",            href: "/search?category=V%C3%A9hicules" },
  { label: "Vacances",             href: "/search?category=Vacances" },
  { label: "Emploi",               href: "/search?category=Emploi" },
  { label: "Mode",                 href: "/search?category=Mode" },
  { label: "Maison",               href: "/search?category=Maison" },
  { label: "Bébé & Enfant",        href: "/search?category=B%C3%A9b%C3%A9%20%26%20Enfant" },
  { label: "Multimédia",           href: "/search?category=Multim%C3%A9dia" },
  { label: "Loisirs",              href: "/search?category=Loisirs" },
  { label: "Animaux",              href: "/search?category=Animaux" },
  { label: "Bons plans !",         href: "/search" },
];

export default async function Navbar({
  active,
  right,
}: {
  active?: string;
  right?: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user;

  // Récupérer isPro pour le menu API
  let isPro = false;
  if (user?.id) {
    const { prisma } = await import("@/lib/prisma");
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isPro: true },
    }).catch(() => null);
    isPro = dbUser?.isPro ?? false;
  }

  return (
    <nav className="fixed top-0 w-full z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="w-full max-w-[1248px] mx-auto px-4 lg:px-6">
        {/* Top Row */}
        <div className="flex items-center justify-between py-3 gap-4 lg:gap-8 min-h-[72px]">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="lg:hidden flex-shrink-0">
              <CategoryDrawer />
            </div>
            <Link href="/" className="flex items-center">
              <img src="/logo.png" alt="Le Bon Deal" className="w-44 h-auto" />
            </Link>
          </div>

          {/* Search Bar avec autocomplétion */}
          <NavSearch />

          {/* Déposer une annonce */}
          <Link
            href="/post"
            className="hidden lg:flex items-center gap-2 bg-[#2f6fb8] hover:bg-[#2560a0] text-white px-4 py-2 rounded-full font-bold text-sm transition-colors flex-shrink-0 whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Déposer une annonce
          </Link>

          {/* Right Action Icons */}
          <div className="flex items-center gap-4 lg:gap-6 flex-shrink-0">
            <UserDropdown user={user} isPro={isPro} />
          </div>
        </div>

        {/* Bottom Row - Categories */}
        <div className="hidden lg:flex items-center justify-between py-2.5 text-[14px] text-slate-600 gap-1 overflow-x-auto hide-scrollbar w-full">
          {CATEGORIES.map((cat, index) => (
            <div key={cat.label} className="flex items-center flex-shrink-0">
              <Link
                href={cat.href}
                className={`hover:text-[#2f6fb8] hover:underline transition-colors ${cat.label === "Bons plans !" ? "font-[800] text-slate-800" : "font-[500]"}`}
              >
                {cat.label}
              </Link>
              {index < CATEGORIES.length - 1 && (
                <span className="mx-2 lg:mx-3 text-slate-400 font-bold opacity-60">·</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}

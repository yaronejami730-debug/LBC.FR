import { auth } from "@/lib/auth";
import Link from "next/link";
import CategoryDrawer from "./CategoryDrawer";
import UserDropdown from "./UserDropdown";
import NavSearch from "./NavSearch";

// Use canonical SEO routes (indexable, with full content) rather than search
// query strings. Top-level nav drives most internal PageRank — every navbar
// click is a crawl signal.
const CATEGORIES = [
  { label: "Immobilier",           href: "/annonces/immobilier" },
  { label: "Véhicules",            href: "/annonces/vehicules" },
  { label: "Vacances",             href: "/annonces/vacances" },
  { label: "Emploi",               href: "/annonces/emploi" },
  { label: "Mode",                 href: "/annonces/mode" },
  { label: "Maison",               href: "/annonces/maison" },
  { label: "Bébé & Enfant",        href: "/annonces/bebe-enfant" },
  { label: "Multimédia",           href: "/annonces/multimedia" },
  { label: "Loisirs",              href: "/annonces/loisirs" },
  { label: "Animaux",              href: "/annonces/animaux" },
  { label: "Bons plans !",         href: "/nouveautes" },
  { label: "Guides",               href: "/blog" },
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
            <Link href="/" title="Accueil Deal&Co" className="flex items-center">
              <img src="/logo.png" alt="Deal&Co" className="w-44 h-auto" />
            </Link>
          </div>

          {/* Search Bar avec autocomplétion */}
          <NavSearch />

          {/* Déposer une annonce */}
          <Link
            href="/post"
            title="Déposer une annonce gratuite"
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
          {CATEGORIES.map((cat, index) => {
            const isFeatured = cat.label === "Immobilier" || cat.label === "Véhicules";
            const isDeals = cat.label === "Bons plans !";
            return (
              <div key={cat.label} className="flex items-center flex-shrink-0">
                <Link
                  href={cat.href}
                  title={isDeals ? "Découvrir les nouveautés" : `Annonces ${cat.label}`}
                  className={`hover:text-[#2f6fb8] hover:underline transition-colors ${
                    isFeatured
                      ? "font-[800] text-[#2f6fb8]"
                      : isDeals
                        ? "font-[800] text-slate-800"
                        : "font-[500]"
                  }`}
                >
                  {cat.label}
                </Link>
                {index < CATEGORIES.length - 1 && (
                  <span className="mx-2 lg:mx-3 text-slate-400 font-bold opacity-60">·</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

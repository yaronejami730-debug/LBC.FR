import { auth } from "@/lib/auth";
import Link from "next/link";
import CategoryDrawer from "./CategoryDrawer";

const CATEGORIES = [
  { label: "Immobilier", href: "/search?category=immobilier" },
  { label: "Véhicules", href: "/search?category=vehicules" },
  { label: "Vacances", href: "/search?category=vacances" },
  { label: "Emploi", href: "/search?category=emploi" },
  { label: "Mode", href: "/search?category=mode" },
  { label: "Maison & Jardin", href: "/search?category=maison-jardin" },
  { label: "Famille", href: "/search?category=famille" },
  { label: "Électronique", href: "/search?category=electronique" },
  { label: "Loisirs", href: "/search?category=loisirs" },
  { label: "Autres", href: "/search?category=autres" },
  { label: "Bons plans !", href: "/search?category=bons-plans" },
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

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 items-center max-w-[640px] bg-slate-100/80 hover:bg-slate-100 transition-colors rounded-full h-[44px] pl-4 pr-1.5 focus-within:ring-2 focus-within:ring-[#2f6fb8]/20 focus-within:bg-white border border-transparent focus-within:border-[#2f6fb8]/30">
            <input 
              type="text" 
              placeholder="Rechercher sur Le Bon Deal"
              className="flex-1 bg-transparent border-none outline-none text-[15px] text-slate-800 placeholder-slate-500 w-full"
            />
            <button className="flex items-center justify-center w-[34px] h-[34px] bg-[#2f6fb8] text-white rounded-full hover:bg-[#2f6fb8]/90 transition-colors flex-shrink-0">
              <span className="material-symbols-outlined text-[18px]">search</span>
            </button>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-4 lg:gap-6 flex-shrink-0">
            <Link href="/recherches" className="hidden lg:flex flex-col items-center gap-1 text-slate-700 hover:text-[#2f6fb8] transition-colors group">
              <span className="material-symbols-outlined text-[24px]">notifications</span>
              <span className="text-[12px] font-medium leading-none">Mes recherches</span>
            </Link>
            <Link href="/favoris" className="flex flex-col items-center gap-1 text-slate-700 hover:text-[#2f6fb8] transition-colors group">
              <span className="material-symbols-outlined text-[24px]">favorite</span>
              <span className="text-[12px] font-medium leading-none hidden lg:block">Favoris</span>
            </Link>
            <Link href="/messages" className="flex flex-col items-center gap-1 text-slate-700 hover:text-[#2f6fb8] transition-colors group">
              <span className="material-symbols-outlined text-[24px]">chat_bubble</span>
              <span className="text-[12px] font-medium leading-none hidden lg:block">Messages</span>
            </Link>
            
            {user ? (
               <Link href="/profile" className="flex flex-col items-center gap-1 text-slate-700 hover:text-[#2f6fb8] transition-colors group">
                 <span className="material-symbols-outlined text-[24px]">person</span>
                 <span className="text-[12px] font-medium leading-none hidden lg:block">{user.name?.split(" ")[0]}</span>
               </Link>
            ) : (
               <Link href="/login" className="flex flex-col items-center gap-1 text-slate-700 hover:text-[#2f6fb8] transition-colors group">
                 <span className="material-symbols-outlined text-[24px]">person</span>
                 <span className="text-[12px] font-medium leading-none hidden lg:block">Se connecter</span>
               </Link>
            )}
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

import { auth } from "@/lib/auth";
import Link from "next/link";
import CategoryDrawer from "./CategoryDrawer";

const NAV = [
  { href: "/", label: "Accueil", key: "accueil" },
  { href: "/search", label: "Recherche", key: "recherche" },
  { href: "/post", label: "Déposer", key: "deposer" },
  { href: "/messages", label: "Messages", key: "messages" },
  { href: "/profile", label: "Profil", key: "profil" },
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
    <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-[0_16px_32px_rgba(21,21,125,0.06)]">
      <div className="flex items-center justify-between px-6 py-4 w-full max-w-7xl mx-auto">
        {/* Left slot with Logo & Hamburger */}
        <div className="flex items-center">
          <CategoryDrawer />
          <Link
            href="/"
            className="text-2xl font-extrabold text-[#15157d] tracking-tighter font-['Manrope'] flex-shrink-0"
          >
            PrèsDeToi
          </Link>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-7 text-slate-500 font-medium">
          {NAV.map(({ href, label, key }) => (
            <Link
              key={key}
              href={href}
              className={
                active === key
                  ? "text-[#15157d] font-bold"
                  : "hover:text-[#15157d] transition-colors"
              }
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Right slot: custom element or auth button */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {right ?? (
            user ? (
              <Link
                href="/profile"
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-semibold text-sm hover:bg-primary/15 transition-colors"
              >
                <span className="material-symbols-outlined text-base">person</span>
                <span className="hidden sm:inline">{user.name?.split(" ")[0]}</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-5 py-2 bg-primary text-white rounded-full font-bold text-sm shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors active:scale-95"
              >
                Se connecter
              </Link>
            )
          )}
        </div>
      </div>
      <div className="bg-slate-100/50 h-[1px]" />
    </nav>
  );
}

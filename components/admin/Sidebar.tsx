"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const navItems = [
  { href: "/admin", icon: "grid_view", label: "Dashboard", exact: true },
  { href: "/admin/users", icon: "group", label: "Utilisateurs", exact: false },
  { href: "/admin/listings", icon: "list_alt", label: "Annonces", exact: false },
  { href: "/admin/ads", icon: "campaign", label: "Publicités", exact: false },
];

export default function Sidebar({ adminName }: { adminName: string }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-white border-r border-[#eceef0] flex flex-col z-40">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-[#eceef0]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#15157d] flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
              shield_person
            </span>
          </div>
          <div>
            <p className="font-extrabold text-[#15157d] text-sm leading-none font-headline">Admin</p>
            <p className="text-[10px] text-[#777683] mt-0.5">PrèsDeToi</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#777683] px-3 mb-3">Menu</p>
        {navItems.map(({ href, icon, label, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-[#15157d] text-white shadow-sm shadow-[#15157d]/20"
                  : "text-[#464652] hover:bg-[#f2f4f6] hover:text-[#15157d]"
              }`}
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                {icon}
              </span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-[#eceef0] space-y-1">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-[#464652] hover:bg-[#f2f4f6] transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          Voir le site
        </Link>
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl">
          <div className="w-6 h-6 rounded-full bg-[#15157d]/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[14px] text-[#15157d]">person</span>
          </div>
          <span className="text-xs text-[#464652] font-medium truncate flex-1">{adminName}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-[#777683] hover:text-[#ba1a1a] transition-colors"
            title="Déconnexion"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

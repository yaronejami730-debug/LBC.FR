"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const navItems = [
  { href: "/admin", icon: "grid_view", label: "Dashboard", exact: true },
  { href: "/admin/users", icon: "group", label: "Utilisateurs", exact: false },
  { href: "/admin/listings", icon: "list_alt", label: "Annonces", exact: false },
  { href: "/admin/ads", icon: "campaign", label: "Publicités", exact: false },
];

export default function AdminSidebar({ adminName, isMobile, onClose }: { adminName: string; isMobile?: boolean; onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className={`${isMobile ? "w-full h-full" : "fixed inset-y-0 left-0 w-64"} bg-white border-r border-[#eceef0] flex flex-col z-50`}>
      {/* Brand */}
      <div className="px-6 py-6 border-b border-[#eceef0] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2f6fb8] to-[#1a5a9e] flex items-center justify-center shadow-lg shadow-[#2f6fb8]/20">
            <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              shield_person
            </span>
          </div>
          <div>
            <p className="font-black text-[#2f6fb8] text-base leading-none tracking-tight font-headline">Admin</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Le Bon Deal</p>
          </div>
        </div>
        {isMobile && (
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
            <span className="material-symbols-outlined text-slate-400">close</span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto no-scrollbar">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-4 mb-4">Gestion</p>
        {navItems.map(({ href, icon, label, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[15px] font-bold transition-all group ${
                isActive
                  ? "bg-[#2f6fb8] text-white shadow-xl shadow-[#2f6fb8]/15 scale-[1.02]"
                  : "text-slate-500 hover:bg-slate-50 hover:text-[#2f6fb8] active:scale-95"
              }`}
            >
              <span
                className={`material-symbols-outlined text-xl transition-transform group-hover:scale-110 ${isActive ? "" : "text-slate-400 group-hover:text-[#2f6fb8]"}`}
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                {icon}
              </span>
              {label}
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white opacity-40" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User / Footer */}
      <div className="p-4 bg-slate-50/50 border-t border-[#eceef0] space-y-2">
        <Link
          href="/"
          className="flex items-center gap-4 px-4 py-3 rounded-2xl text-sm font-bold text-slate-600 hover:bg-white hover:text-[#2f6fb8] hover:shadow-sm transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-lg">open_in_new</span>
          Voir le site
        </Link>
        <div className="flex items-center gap-4 px-4 py-4 rounded-2xl bg-white border border-[#eceef0] shadow-sm">
          <div className="w-10 h-10 rounded-full bg-[#2f6fb8]/5 flex items-center justify-center flex-shrink-0 border border-[#2f6fb8]/10">
            <span className="material-symbols-outlined text-xl text-[#2f6fb8]">person_filled</span>
          </div>
          <div className="flex-1 min-w-0 mr-2">
            <p className="text-sm font-black text-[#2f6fb8] truncate leading-tight">{adminName}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Super Admin</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 transition-all border border-transparent"
            title="Déconnexion"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

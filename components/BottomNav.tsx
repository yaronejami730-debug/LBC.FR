"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

const PUBLIC_ITEMS = [
  { href: "/", label: "Accueil", icon: "home", key: "accueil" },
  { href: "/search", label: "Recherche", icon: "search", key: "recherche" },
];

const AUTH_ITEMS = [
  { href: "/post", label: "Déposer", icon: "add_circle", key: "deposer" },
  { href: "/favoris", label: "Favoris", icon: "favorite", key: "favoris" },
  { href: "/messages", label: "Messages", icon: "chat", key: "messages" },
  { href: "/profile", label: "Profil", icon: "person", key: "profil" },
];

export default function BottomNav({ active }: { active?: string }) {
  const { data: session, status } = useSession();
  const isLoggedIn = !!session?.user;
  const loading = status === "loading";

  return (
    <footer className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 bg-white/90 backdrop-blur-xl shadow-[0_-8px_24px_rgba(21,21,125,0.04)] z-50 rounded-t-2xl border-t border-slate-200/20">
      {/* Public items always visible */}
      {PUBLIC_ITEMS.map(({ href, label, icon, key }) => {
        const isActive = active === key;
        return (
          <Link
            key={key}
            href={href}
            className={`flex flex-col items-center justify-center px-3 py-1 transition-all ${
              isActive ? "text-[#2f6fb8] font-bold bg-[#d5e3fc]/30 rounded-xl" : "text-slate-400 hover:text-[#2f6fb8]"
            }`}
          >
            <span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>
              {icon}
            </span>
            <span className="font-['Inter'] text-[11px] font-medium uppercase tracking-[0.05em] mt-0.5">{label}</span>
          </Link>
        );
      })}

      {/* Auth-dependent section */}
      {loading ? (
        // Skeleton while session resolves
        <div className="flex gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1 px-3 py-1 opacity-30">
              <div className="w-6 h-6 rounded bg-slate-300 animate-pulse" />
              <div className="w-10 h-2 rounded bg-slate-300 animate-pulse" />
            </div>
          ))}
        </div>
      ) : isLoggedIn ? (
        // Logged in: show all three items
        AUTH_ITEMS.map(({ href, label, icon, key }) => {
          const isActive = active === key;
          return (
            <Link
              key={key}
              href={href}
              className={`flex flex-col items-center justify-center px-3 py-1 transition-all ${
                isActive ? "text-[#2f6fb8] font-bold bg-[#d5e3fc]/30 rounded-xl" : "text-slate-400 hover:text-[#2f6fb8]"
              }`}
            >
              <span
                className={`material-symbols-outlined ${key === "deposer" ? "text-primary" : ""}`}
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {icon}
              </span>
              <span className="font-['Inter'] text-[11px] font-medium uppercase tracking-[0.05em] mt-0.5">{label}</span>
            </Link>
          );
        })
      ) : (
        // Logged out: single "Se connecter" button
        <Link
          href="/login"
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-full font-bold text-sm shadow-md shadow-primary/20 active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-base">login</span>
          Se connecter
        </Link>
      )}
    </footer>
  );
}



e"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const PUBLIC_ITEMS = [
  { href: "/", label: "Accueil", icon: "home", key: "accueil" },
  { href: "/search", label: "Recherche", icon: "search", key: "recherche" },
];

const AUTH_ITEMS = [
  { href: "/post", label: "Déposer", icon: "add_circle", key: "deposer" },
  { href: "/favoris", label: "Favoris", icon: "favorite", key: "favoris" },
  { href: "/messages", label: "Messages", icon: "chat", key: "messages" },
];

export default function BottomNav({ active }: { active?: string }) {
  const { data: session, status } = useSession();
  const isLoggedIn = !!session?.user;
  const loading = status === "loading";
  const pathname = usePathname();

  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!isLoggedIn) return;

    // Clear badge immediately when on messages page
    if (pathname?.startsWith("/messages")) {
      setUnread(0);
      return;
    }

    async function fetchUnread() {
      try {
        const res = await fetch(`/api/messages/unread?t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          setUnread(data.count ?? 0);
        }
      } catch { /* ignore */ }
    }

    fetchUnread();
    const interval = setInterval(fetchUnread, 3_000);
    return () => clearInterval(interval);
  }, [isLoggedIn, pathname]);

  return (
    <footer className="md:hidden fixed bottom-0 left-0 w-full flex justify-evenly items-center pb-6 pt-3 bg-white/90 backdrop-blur-xl shadow-[0_-8px_24px_rgba(21,21,125,0.04)] z-50 rounded-t-2xl border-t border-slate-200/20">
      {/* Public items always visible */}
      {PUBLIC_ITEMS.map(({ href, label, icon, key }) => {
        const isActive = active === key;
        return (
          <Link
            key={key}
            href={href}
            className={`flex flex-col items-center justify-center px-3 py-1 transition-all ${isActive ? "text-[#2f6fb8] font-bold bg-[#d5e3fc]/30 rounded-xl" : "text-slate-400 hover:text-[#2f6fb8]"
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
        <div className="flex gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1 px-3 py-1 opacity-30">
              <div className="w-6 h-6 rounded bg-slate-300 animate-pulse" />
              <div className="w-10 h-2 rounded bg-slate-300 animate-pulse" />
            </div>
          ))}
        </div>
      ) : isLoggedIn ? (
        AUTH_ITEMS.map(({ href, label, icon, key }) => {
          const isActive = active === key;
          const showBadge = key === "messages" && unread > 0;
          return (
            <Link
              key={key}
              href={href}
              className={`flex flex-col items-center justify-center px-3 py-1 transition-all ${isActive ? "text-[#2f6fb8] font-bold bg-[#d5e3fc]/30 rounded-xl" : "text-slate-400 hover:text-[#2f6fb8]"
                }`}
            >
              <span className="relative">
                <span
                  className={`material-symbols-outlined ${key === "deposer" ? "text-primary" : ""}`}
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {icon}
                </span>
                {showBadge && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </span>
              <span className="font-['Inter'] text-[11px] font-medium uppercase tracking-[0.05em] mt-0.5">{label}</span>
            </Link>
          );
        })
      ) : (
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

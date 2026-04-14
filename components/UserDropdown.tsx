"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  user?: { name?: string | null; email?: string | null } | null;
};

const MENU_ITEMS = [
  { label: "Messages",       icon: "chat_bubble",   href: "/messages", badge: true },
  { label: "Favoris",        icon: "favorite",      href: "/favoris",  badge: false },
  { label: "Mes recherches", icon: "notifications", href: "/recherches", badge: false },
];

export default function UserDropdown({ user }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const [unread, setUnread] = useState(0);
  const btnRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Position le dropdown sous le bouton en fixed
  function updatePos() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });
  }

  // Polling du compteur de messages non lus
  useEffect(() => {
    if (!user) return;

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
  }, [user, pathname]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.closest("[data-dropdown]")?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div data-dropdown="">
      {/* Trigger — toujours visible */}
      <button
        ref={btnRef}
        onClick={() => { updatePos(); setOpen((v) => !v); }}
        className="relative flex items-center gap-2 px-3 py-2 rounded-full border border-slate-200 text-slate-700 hover:border-[#2f6fb8] hover:text-[#2f6fb8] transition-all bg-white shadow-sm"
      >
        <span className="material-symbols-outlined text-[20px]">menu</span>
        <span className="material-symbols-outlined text-[20px]">person</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full hidden md:flex items-center justify-center leading-none shadow-sm">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown — fixed pour éviter tout clipping */}
      {open && (
        <div
          style={{ top: pos.top, right: pos.right }}
          className="fixed w-52 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[9999]"
        >
          {user ? (
            <>
              {/* En-tête connecté */}
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[13px] font-bold text-slate-800 truncate">{user.name}</p>
                {user.email && <p className="text-[11px] text-slate-400 truncate">{user.email}</p>}
              </div>

              {/* Items */}
              <div className="py-1">
                {MENU_ITEMS.map((item) => {
                  const showBadge = item.badge && unread > 0;
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-[#2f6fb8] transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                      <span className="text-[14px] font-medium flex-1">{item.label}</span>
                      {showBadge && (
                        <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full hidden md:flex items-center justify-center leading-none">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Pied */}
              <div className="border-t border-slate-100 py-1">
                <Link href="/profile" onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-[#2f6fb8] transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                  <span className="text-[14px] font-medium">Mon profil</span>
                </Link>
              </div>
            </>
          ) : (
            /* Non connecté */
            <div className="py-1">
              <Link href="/login" onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-[#2f6fb8] transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">login</span>
                <span className="text-[14px] font-medium">Se connecter</span>
              </Link>
              {MENU_ITEMS.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-[#2f6fb8] transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  <span className="text-[14px] font-medium">{item.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

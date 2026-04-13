"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Props = {
  user?: { name?: string | null; email?: string | null } | null;
};

const MENU_ITEMS = [
  { label: "Messages",       icon: "chat_bubble",   href: "/messages" },
  { label: "Favoris",        icon: "favorite",      href: "/favoris" },
  { label: "Mes recherches", icon: "notifications", href: "/recherches" },
];

export default function UserDropdown({ user }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  // Position le dropdown sous le bouton en fixed
  function updatePos() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });
  }

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
        className="flex items-center gap-2 px-3 py-2 rounded-full border border-slate-200 text-slate-700 hover:border-[#2f6fb8] hover:text-[#2f6fb8] transition-all bg-white shadow-sm"
      >
        <span className="material-symbols-outlined text-[20px]">menu</span>
        <span className="material-symbols-outlined text-[20px]">person</span>
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
                {MENU_ITEMS.map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-[#2f6fb8] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span className="text-[14px] font-medium">{item.label}</span>
                  </Link>
                ))}
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

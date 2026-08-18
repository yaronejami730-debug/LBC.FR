"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { visibleSections, sectionForPath, type AdminSection } from "@/lib/admin/sections";

/**
 * Barre latérale de l'administration.
 *
 * Elle affichait une vingtaine d'entrées à plat, dans l'ordre où elles avaient
 * été écrites. « Annonceurs », « Comptes annonceurs », « Publicités »,
 * « Campagnes pub » et « Bannières » se suivaient sans qu'on puisse deviner
 * lequel servait à quoi. Les chapitres viennent de `lib/admin/sections`, qui
 * sert aussi de référence aux droits d'équipe : un écran ajouté apparaît au bon
 * endroit et devient attribuable, sans seconde liste à tenir à jour.
 *
 * Le chapitre de la page courante s'ouvre tout seul ; les autres restent
 * repliés. Un menu qui déroule tout ne vaut pas mieux qu'une liste plate.
 */

export default function AdminSidebar({
  adminName,
  isMobile,
  onClose,
  sections = ["*"],
  teamLabel,
}: {
  adminName: string;
  isMobile?: boolean;
  onClose?: () => void;
  /** Clés de section accordées au compte. `["*"]` = accès complet. */
  sections?: string[];
  /** Équipes de la personne, affichées sous son nom. */
  teamLabel?: string;
}) {
  const pathname = usePathname();
  const chapters = visibleSections(sections);
  const current = sectionForPath(pathname);

  // Un seul chapitre ouvert à la fois, celui où l'on travaille. `null` avant
  // toute interaction : la valeur initiale suit l'adresse, pas un état figé.
  const [opened, setOpened] = useState<string | null>(null);
  const isOpen = (s: AdminSection) => (opened === null ? s.key === current?.key : opened === s.key);

  return (
    <aside className={`${isMobile ? "w-full h-full" : "fixed inset-y-0 left-0 w-64"} bg-white border-r border-[#eceef0] flex flex-col z-50`}>
      {/* Brand */}
      <div className="px-6 py-5 border-b border-[#eceef0] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/logo-dealco.png"
            alt="deal&co"
            width={120}
            height={38}
            className="object-contain"
            priority
          />
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest border-l border-[#eceef0] pl-3">Admin</span>
        </div>
        {isMobile && (
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
            <span className="material-symbols-outlined text-slate-400">close</span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto no-scrollbar">
        {chapters.map((section) => {
          const open = isOpen(section);
          const active = current?.key === section.key;

          // Un chapitre à une seule entrée n'a rien à replier : le déplier
          // demanderait deux clics pour atteindre un lien unique.
          if (section.entries.length === 1) {
            const entry = section.entries[0];
            const here = entry.exact ? pathname === entry.href : pathname.startsWith(entry.href);
            return (
              <Link
                key={section.key}
                href={entry.href}
                onClick={onClose}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[14px] font-bold transition-all ${
                  here
                    ? "bg-[#2f6fb8] text-white shadow-lg shadow-[#2f6fb8]/15"
                    : "text-slate-500 hover:bg-slate-50 hover:text-[#2f6fb8]"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[20px] ${here ? "" : "text-slate-400"}`}
                  style={{ fontVariationSettings: here ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {section.icon}
                </span>
                {section.label}
              </Link>
            );
          }

          return (
            <div key={section.key}>
              <button
                type="button"
                onClick={() => setOpened(open ? "" : section.key)}
                aria-expanded={open}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[14px] font-bold transition-all ${
                  active && !open
                    ? "bg-[#2f6fb8]/8 text-[#2f6fb8]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-[#2f6fb8]"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[20px] ${active ? "text-[#2f6fb8]" : "text-slate-400"}`}
                  style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {section.icon}
                </span>
                <span className="flex-1 text-left">{section.label}</span>
                <span
                  className={`material-symbols-outlined text-[18px] text-slate-300 transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                >
                  expand_more
                </span>
              </button>

              {open && (
                <div className="mt-1 mb-2 ml-5 border-l border-slate-100 pl-3 space-y-0.5">
                  {section.entries.map((entry) => {
                    const here = entry.exact
                      ? pathname === entry.href
                      : pathname.startsWith(entry.href);
                    return (
                      <Link
                        key={entry.href}
                        href={entry.href}
                        onClick={onClose}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-semibold transition-all ${
                          here
                            ? "bg-[#2f6fb8] text-white shadow-md shadow-[#2f6fb8]/15"
                            : "text-slate-500 hover:bg-slate-50 hover:text-[#2f6fb8]"
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-[18px] ${here ? "" : "text-slate-300"}`}
                          style={{ fontVariationSettings: here ? "'FILL' 1" : "'FILL' 0" }}
                        >
                          {entry.icon}
                        </span>
                        {entry.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
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
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">
              {teamLabel ?? "Super Admin"}
            </p>
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

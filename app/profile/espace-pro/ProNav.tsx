import Link from "next/link";

const TABS = [
  { href: "/profile/espace-pro", label: "Ma fiche", icon: "storefront" },
  { href: "/profile/espace-pro/agenda", label: "Agenda", icon: "calendar_month" },
  { href: "/profile/espace-pro/equipe", label: "Équipe & horaires", icon: "group" },
  { href: "/profile/espace-pro/parametres", label: "Réservation", icon: "tune" },
];

/**
 * Navigation de l'espace professionnel, et surtout lien vers la fiche
 * publique : le pro n'avait aucun moyen d'atteindre sa propre page depuis
 * son back-office, elle n'existait que pour ses clients.
 */
export default function ProNav({ current, slug }: { current: string; slug?: string | null }) {
  return (
    <div className="mb-5 space-y-3">
      <nav className="flex gap-1.5 overflow-x-auto no-scrollbar" aria-label="Espace professionnel">
        {TABS.map((tab) => {
          const active = tab.href === current;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              title={tab.label}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                active ? "bg-primary text-white" : "bg-white border border-slate-100 text-on-surface-variant hover:border-primary hover:text-primary"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {slug && (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/pro/${slug}`}
            title="Voir ma page publique"
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-primary"
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            Voir ma page publique
          </Link>
          <Link
            href={`/pro/${slug}/reserver`}
            title="Tester le parcours de réservation"
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-primary"
          >
            <span className="material-symbols-outlined text-[16px]">event_available</span>
            Tester la réservation
          </Link>
        </div>
      )}
    </div>
  );
}

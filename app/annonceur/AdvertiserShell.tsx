import Link from "next/link";
import { Sora } from "next/font/google";
import AdvertiserSignOut from "./AdvertiserSignOut";
import { COLORS } from "@/lib/ads/theme";

export { COLORS };

/**
 * Coquille de l'espace annonceur, d'après la maquette Deal&Co Ads.
 *
 * Le vocabulaire visuel est celui de la maquette et non celui de la
 * marketplace : fond bleuté très clair, cartes blanches à grand rayon,
 * dégradé bleu sur les actions principales, Sora pour les titres. C'est
 * assumé — l'annonceur n'est pas un visiteur de Deal&Co, il travaille dans un
 * outil, et l'écran doit le lui dire dès le premier regard.
 *
 * Les couleurs sont écrites en clair plutôt que via les jetons Tailwind du
 * site : ce sont celles de la maquette, elles n'ont pas d'équivalent dans le
 * thème public, et les inventer aurait produit un à-peu-près.
 */
const sora = Sora({ subsets: ["latin"], weight: ["600", "700", "800"], display: "swap" });


const NAV = [
  { href: "/annonceur", label: "Tableau de bord", icon: "grid_view" },
  { href: "/annonceur/campagnes", label: "Campagnes", icon: "campaign" },
  { href: "/annonceur/facturation", label: "Budget", icon: "account_balance_wallet" },
  { href: "/annonceur/mot-de-passe", label: "Sécurité", icon: "lock" },
];

export default function AdvertiserShell({
  title,
  subtitle,
  advertiserName,
  contactName,
  current,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  advertiserName: string;
  contactName: string;
  /** Chemin de la page courante, pour marquer l'entrée active. */
  current: string;
  /** Action principale de l'entête, quand la page en a une. */
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  const initial = advertiserName.trim().charAt(0).toUpperCase() || "A";

  return (
    <div className={`${sora.className} min-h-screen flex`} style={{ background: COLORS.ground, color: COLORS.ink }}>
      {/* Barre latérale — masquée sur mobile, où la navigation passe en bas
          de l'entête : un dashboard consulté entre deux services l'est au
          téléphone aussi souvent qu'au bureau. */}
      <aside
        className="hidden md:flex w-60 flex-none flex-col gap-6 px-4 py-5 sticky top-0 h-screen"
        style={{ background: "#fff", borderRight: `1px solid ${COLORS.line}` }}
      >
        <div className="flex items-center gap-2.5 px-2">
          <span
            className="w-9 h-9 rounded-[11px] grid place-items-center text-white shrink-0"
            style={{
              background: `linear-gradient(135deg, ${COLORS.blueLight}, ${COLORS.blue})`,
              boxShadow: "0 6px 14px -4px rgba(37,99,235,0.5)",
            }}
          >
            <span className="material-symbols-outlined text-[18px]">campaign</span>
          </span>
          <span className="min-w-0">
            <span className="block font-extrabold text-[16px] leading-tight">Deal&amp;Co</span>
            <span className="block text-[11px] font-semibold" style={{ color: COLORS.muted }}>
              Espace annonceur
            </span>
          </span>
        </div>

        <nav className="flex flex-col gap-0.5 flex-1">
          {NAV.map((item) => {
            const active = item.href === current;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-bold transition-colors"
                style={
                  active
                    ? { background: COLORS.tint, color: COLORS.blue }
                    : { color: COLORS.soft }
                }
              >
                <span className="material-symbols-outlined text-[17px]">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div
          className="flex items-center gap-2.5 px-2 py-2.5"
          style={{ borderTop: `1px solid ${COLORS.line}` }}
        >
          <span
            className="w-[34px] h-[34px] rounded-full grid place-items-center text-white font-bold text-[13px] shrink-0"
            style={{ background: `linear-gradient(135deg, ${COLORS.blueLight}, ${COLORS.blue})` }}
          >
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-bold truncate">{contactName}</span>
            <span className="block text-[10.5px] font-semibold truncate" style={{ color: COLORS.muted }}>
              {advertiserName}
            </span>
          </span>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header
          className="flex items-center justify-between gap-4 px-5 md:px-9 py-4 md:py-5"
          style={{ background: "#fff", borderBottom: `1px solid ${COLORS.line}` }}
        >
          <div className="min-w-0">
            <h1 className="font-extrabold text-[19px] md:text-[21px] truncate">{title}</h1>
            {subtitle && (
              <p className="text-[13px] font-semibold mt-0.5 truncate" style={{ color: COLORS.muted }}>
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {action && (
              <Link
                href={action.href}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.blueLight})`,
                  boxShadow: "0 10px 20px -10px rgba(29,78,216,0.5)",
                }}
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                <span className="hidden sm:inline">{action.label}</span>
              </Link>
            )}
            <AdvertiserSignOut />
          </div>
        </header>

        {/* Navigation de repli sur mobile : la barre latérale disparaît, mais
            on ne perd pas l'accès aux autres écrans. */}
        <nav
          className="md:hidden flex gap-1 px-4 py-2 overflow-x-auto"
          style={{ background: "#fff", borderBottom: `1px solid ${COLORS.line}` }}
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-[12.5px] font-bold"
              style={
                item.href === current
                  ? { background: COLORS.tint, color: COLORS.blue }
                  : { color: COLORS.soft }
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 px-5 md:px-9 py-6 md:py-8 pb-16">{children}</main>
      </div>
    </div>
  );
}

import Link from "next/link";
import ListingCard, { type HomeListing } from "./ListingCard";

type RowTone = "default" | "tinted" | "dark" | "warm";

const TONE_BG: Record<RowTone, string> = {
  default: "bg-transparent",
  tinted: "bg-surface-container-low",
  dark: "bg-[#0f172a] text-white",
  warm: "bg-amber-50",
};

const EYEBROW_COLOR: Record<RowTone, string> = {
  default: "text-primary",
  tinted: "text-primary",
  dark: "text-amber-300",
  warm: "text-amber-700",
};

export default function ListingRow({
  eyebrow,
  title,
  href,
  hrefLabel = "Voir tout",
  icon,
  tone = "default",
  rounded = false,
  cardSize = "md",
  cardBadge,
  listings,
}: {
  eyebrow?: string;
  title: string;
  href: string;
  hrefLabel?: string;
  icon?: string;
  tone?: RowTone;
  rounded?: boolean;
  cardSize?: "sm" | "md" | "lg";
  cardBadge?: { label: string; tone: "premium" | "bargain" | "verified" | "fresh" };
  listings: HomeListing[];
}) {
  if (listings.length === 0) return null;

  return (
    <section className={`${TONE_BG[tone]} ${rounded ? "rounded-2xl" : ""} px-6 py-8 max-w-7xl mx-auto`}>
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {icon && (
            <span
              className={`material-symbols-outlined text-2xl ${tone === "dark" ? "text-amber-300" : "text-primary"}`}
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {icon}
            </span>
          )}
          <div>
            {eyebrow && (
              <span className={`${EYEBROW_COLOR[tone]} font-bold uppercase tracking-[0.1em] text-[11px]`}>
                {eyebrow}
              </span>
            )}
            <h2 className={`text-xl md:text-2xl font-extrabold tracking-tight ${tone === "dark" ? "text-white" : "text-on-surface"}`}>
              {title}
            </h2>
          </div>
        </div>
        <Link
          href={href}
          title={hrefLabel}
          className={`text-sm font-semibold flex items-center gap-1 group ${tone === "dark" ? "text-amber-300" : "text-primary"}`}
        >
          {hrefLabel}
          <span className="material-symbols-outlined text-base group-hover:translate-x-0.5 transition-transform">
            arrow_forward
          </span>
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3 no-scrollbar md:grid md:grid-cols-4 lg:grid-cols-5 md:gap-4 md:overflow-visible md:pb-0">
        {listings.map((l, i) => (
          <ListingCard
            key={l.id}
            listing={l}
            size={cardSize}
            badge={cardBadge}
            priority={i === 0}
          />
        ))}
      </div>
    </section>
  );
}

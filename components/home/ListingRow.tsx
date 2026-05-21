import Link from "next/link";
import ListingCard, { type HomeListing } from "./ListingCard";

export default function ListingRow({
  title,
  subtitle,
  href,
  hrefLabel = "Voir tout",
  cardSize = "md",
  cardBadge,
  listings,
}: {
  title: string;
  subtitle?: string;
  href: string;
  hrefLabel?: string;
  cardSize?: "sm" | "md" | "lg";
  cardBadge?: { label: string; tone: "premium" | "bargain" | "verified" | "fresh" };
  listings: HomeListing[];
}) {
  if (listings.length === 0) return null;

  return (
    <section className="px-6 py-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-4 gap-3">
        <div className="min-w-0">
          <h2 className="text-lg md:text-xl font-bold tracking-tight text-on-surface">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs md:text-sm text-outline mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        <Link
          href={href}
          title={hrefLabel}
          className="shrink-0 text-sm font-semibold text-primary flex items-center gap-1 group"
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

import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "@/lib/utils";
import { listingUrl } from "@/lib/listing-slug";
import DejaVuBadge from "@/components/DejaVuBadge";

type HomeListing = {
  id: string;
  title: string;
  price: number;
  location: string;
  images: string;
  createdAt: Date;
  isPremium: boolean;
};

export default function ListingCard({
  listing,
  size = "md",
  badge,
  priority = false,
}: {
  listing: HomeListing;
  size?: "sm" | "md" | "lg";
  badge?: { label: string; tone: "premium" | "bargain" | "verified" | "fresh" };
  priority?: boolean;
}) {
  let images: string[] = [];
  try {
    const parsed = JSON.parse(listing.images);
    if (Array.isArray(parsed)) images = parsed as string[];
  } catch {}
  const img = images[0];

  const widthClass =
    size === "lg" ? "w-60 md:w-auto" : size === "sm" ? "w-40 md:w-auto" : "w-48 md:w-auto";

  const badgeTone =
    badge?.tone === "premium"
      ? "bg-secondary-container text-on-secondary-container"
      : badge?.tone === "bargain"
        ? "bg-emerald-600 text-white"
        : badge?.tone === "verified"
          ? "bg-[#2f6fb8] text-white"
          : "bg-rose-500 text-white";

  return (
    <Link
      href={listingUrl(listing.id, listing.title)}
      title={`${listing.title} — ${listing.price.toLocaleString("fr-FR")} €`}
      className={`flex-shrink-0 ${widthClass} group flex flex-col bg-white rounded-2xl overflow-hidden border border-[#e6e8eb] hover:border-[#c7c5d4] hover:shadow-sm transition-all duration-200`}
    >
      <div className="relative aspect-square overflow-hidden bg-surface-container-low">
        {img ? (
          <Image
            src={img}
            alt={`${listing.title}${listing.location ? ` à ${listing.location.split(/[,(]/)[0]?.trim()}` : ""} — ${listing.price.toLocaleString("fr-FR")} €`}
            fill
            priority={priority}
            sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,20vw"
            className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-outline/30">image</span>
          </div>
        )}
        {badge ? (
          <span className={`absolute top-2 left-2 ${badgeTone} text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide`}>
            {badge.label}
          </span>
        ) : listing.isPremium ? (
          <span className="absolute top-2 left-2 bg-secondary-container text-on-secondary-container text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
            Premium
          </span>
        ) : null}
        <DejaVuBadge listingId={listing.id} />
      </div>
      <div className="px-3 py-3 flex flex-col gap-1">
        <p className="text-[#191c1e] font-extrabold text-[15px] leading-snug line-clamp-2 min-h-[2.5em]">
          {listing.title}
        </p>
        <p className="text-[#2f6fb8] font-extrabold text-lg leading-none mt-1">
          {listing.price.toLocaleString("fr-FR")} €
        </p>
        <p className="text-[#777683] text-xs truncate mt-1">{listing.location}</p>
        <p className="text-[#9ca3af] text-[11px]">{formatDistanceToNow(listing.createdAt)}</p>
      </div>
    </Link>
  );
}

export type { HomeListing };

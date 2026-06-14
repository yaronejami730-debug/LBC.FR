/**
 * Couche d'accès aux annonces pour le serveur MCP (lib/mcp).
 *
 * Sans HTTP : réutilise la logique de recherche déjà en prod
 * (OpenSearch + repli PostgreSQL, cf. app/api/listings/route.ts GET).
 *
 * Lecture seule, public : n'expose QUE les annonces APPROVED, non
 * shadow-banned, non supprimées. Aucune donnée privée (téléphone, email…).
 * Chaque résultat porte une URL absolue vers le site pour que l'agent IA
 * redirige l'utilisateur vers dealandcompany.fr.
 */

import { prisma } from "@/lib/prisma";
import { buildSearchWhere, type SearchParams } from "@/lib/search-where";
import { isOpenSearchEnabled } from "@/lib/opensearch";
import { searchListings } from "@/lib/opensearch-search";
import { listingUrl } from "@/lib/listing-slug";

export const SITE_BASE_URL =
  process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://www.dealandcompany.fr";

const PUBLIC_USER_SELECT = {
  name: true,
  isPro: true,
  companyName: true,
  verified: true,
} as const;

type ListingRow = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  subcategory: string | null;
  location: string;
  condition: string;
  images: string;
  metadata: string;
  createdAt: Date;
  user?: {
    name: string | null;
    isPro: boolean;
    companyName: string | null;
    verified: boolean;
  } | null;
};

function parseJsonArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function absoluteImage(url: string): string {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${SITE_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** Forme compacte renvoyée dans les listes de résultats. */
export type McpListing = {
  id: string;
  title: string;
  price: number;
  location: string;
  category: string;
  subcategory: string | null;
  url: string;
  image: string | null;
};

export function toMcpListing(row: ListingRow): McpListing {
  const images = parseJsonArray(row.images);
  return {
    id: row.id,
    title: row.title,
    price: row.price,
    location: row.location,
    category: row.category,
    subcategory: row.subcategory,
    url: `${SITE_BASE_URL}${listingUrl(row.id, row.title)}`,
    image: images.length ? absoluteImage(images[0]) : null,
  };
}

/** Forme détaillée renvoyée par get_listing / fetch. */
export type McpListingDetail = McpListing & {
  description: string;
  condition: string;
  createdAt: string;
  images: string[];
  metadata: Record<string, unknown>;
  seller: { name: string; isPro: boolean; verified: boolean } | null;
};

export function toMcpListingDetail(row: ListingRow): McpListingDetail {
  const base = toMcpListing(row);
  const images = parseJsonArray(row.images).map(absoluteImage);
  const seller = row.user
    ? {
        name:
          row.user.isPro && row.user.companyName
            ? row.user.companyName
            : row.user.name ?? "Vendeur",
        isPro: row.user.isPro,
        verified: row.user.verified,
      }
    : null;
  return {
    ...base,
    description: row.description,
    condition: row.condition,
    createdAt: row.createdAt.toISOString(),
    images,
    metadata: parseJsonObject(row.metadata),
    seller,
  };
}

/**
 * Recherche d'annonces. Reproduit le flux de app/api/listings/route.ts :
 * OpenSearch si configuré, repli PostgreSQL sinon. `page` est 1-indexé.
 * Renvoie toujours uniquement des annonces publiquement visibles.
 */
export async function searchListingsForMcp(
  params: SearchParams,
  page = 1,
  perPage = 10,
): Promise<{ listings: McpListing[]; total: number; page: number; perPage: number }> {
  if (isOpenSearchEnabled()) {
    try {
      const { ids, total } = await searchListings(
        params as Record<string, string>,
        page,
        perPage,
      );
      const rows = ids.length
        ? await prisma.listing.findMany({
            where: { id: { in: ids } },
            include: { user: { select: PUBLIC_USER_SELECT } },
          })
        : [];
      const byId = new Map(rows.map((r) => [r.id, r]));
      const ordered = ids
        .map((id) => byId.get(id))
        .filter((r): r is (typeof rows)[number] => Boolean(r));
      return {
        listings: ordered.map((r) => toMcpListing(r as ListingRow)),
        total,
        page,
        perPage,
      };
    } catch (err) {
      console.error("[mcp] OpenSearch KO, repli PostgreSQL:", err);
    }
  }

  // Repli PostgreSQL — forcer la visibilité publique explicitement.
  const where = {
    ...buildSearchWhere(params),
    status: "APPROVED",
    shadowBanned: false,
    deletedAt: null,
  };

  const sort = params.sort;
  const orderBy =
    sort === "price_asc"
      ? { price: "asc" as const }
      : sort === "price_desc"
        ? { price: "desc" as const }
        : { createdAt: "desc" as const };

  const [rows, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      include: { user: { select: PUBLIC_USER_SELECT } },
    }),
    prisma.listing.count({ where }),
  ]);

  return {
    listings: rows.map((r) => toMcpListing(r as ListingRow)),
    total,
    page,
    perPage,
  };
}

/**
 * Détail d'une annonce par id. Renvoie null si introuvable ou non
 * publiquement visible (PENDING/REJECTED, shadow-ban, supprimée).
 */
export async function getListingForMcp(id: string): Promise<McpListingDetail | null> {
  const row = await prisma.listing.findFirst({
    where: { id, status: "APPROVED", shadowBanned: false, deletedAt: null },
    include: { user: { select: PUBLIC_USER_SELECT } },
  });
  if (!row) return null;
  return toMcpListingDetail(row as ListingRow);
}

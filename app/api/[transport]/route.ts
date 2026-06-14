/**
 * Serveur MCP public de Deal & Co — transport Streamable HTTP + SSE.
 *
 * Routage Next.js : ce fichier est mappé sur `app/api/[transport]/route.ts`
 * avec `basePath: "/api"`, ce qui expose :
 *   - POST/GET  https://www.dealandcompany.fr/api/mcp   (Streamable HTTP, recommandé)
 *   - GET       https://www.dealandcompany.fr/api/sse   (legacy SSE)
 *
 * Objectif : permettre à ChatGPT (connecteurs / mode développeur) et autres
 * agents IA de chercher les annonces et de renvoyer l'utilisateur vers le site.
 *
 * Accès public, lecture seule. Aucune donnée privée exposée.
 *
 * Outils :
 *   - search           : contrat ChatGPT (query → {results:[{id,title,url}]})
 *   - fetch            : contrat ChatGPT (id → document)
 *   - search_listings  : recherche riche (catégorie, lieu, prix, tri)
 *   - list_categories  : les catégories disponibles
 *   - get_listing      : détail complet d'une annonce
 */

import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { CATEGORIES } from "@/lib/categories";
import {
  searchListingsForMcp,
  getListingForMcp,
  SITE_BASE_URL,
} from "@/lib/mcp/listings-service";
import type { SearchParams } from "@/lib/search-where";

export const runtime = "nodejs"; // Prisma + pg : pas de runtime edge
export const maxDuration = 60;

/** Enveloppe MCP : un bloc texte JSON (lisible par tous les clients MCP). */
function jsonContent(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

const SORT_VALUES = ["recent", "price_asc", "price_desc"] as const;

const handler = createMcpHandler(
  (server) => {
    // ─── Contrat ChatGPT : search ────────────────────────────────────────
    server.registerTool(
      "search",
      {
        title: "Rechercher des annonces",
        description:
          "Recherche des annonces sur Deal & Co (dealandcompany.fr), toutes catégories confondues (voitures, immobilier, multimédia…). Renvoie une liste de résultats avec leur URL sur le site.",
        inputSchema: {
          query: z
            .string()
            .describe("Termes de recherche en langage naturel, ex: 'voiture diesel Lyon'"),
        },
      },
      async ({ query }) => {
        const { listings, total } = await searchListingsForMcp({ q: query }, 1, 10);
        return jsonContent({
          results: listings.map((l) => ({
            id: l.id,
            title: l.title,
            url: l.url,
          })),
          total,
        });
      },
    );

    // ─── Contrat ChatGPT : fetch ─────────────────────────────────────────
    server.registerTool(
      "fetch",
      {
        title: "Détail d'une annonce",
        description:
          "Récupère le contenu complet d'une annonce Deal & Co à partir de son id (renvoyé par 'search').",
        inputSchema: {
          id: z.string().describe("Identifiant de l'annonce"),
        },
      },
      async ({ id }) => {
        const listing = await getListingForMcp(id);
        if (!listing) {
          return jsonContent({ error: "Annonce introuvable ou non disponible", id });
        }
        const text = [
          listing.title,
          `Prix : ${listing.price} €`,
          `Lieu : ${listing.location}`,
          `Catégorie : ${listing.category}${listing.subcategory ? ` › ${listing.subcategory}` : ""}`,
          `État : ${listing.condition}`,
          "",
          listing.description,
        ].join("\n");
        return jsonContent({
          id: listing.id,
          title: listing.title,
          text,
          url: listing.url,
          metadata: {
            price: listing.price,
            location: listing.location,
            category: listing.category,
            subcategory: listing.subcategory,
            image: listing.image,
            seller: listing.seller,
            ...listing.metadata,
          },
        });
      },
    );

    // ─── Recherche riche ─────────────────────────────────────────────────
    server.registerTool(
      "search_listings",
      {
        title: "Recherche filtrée d'annonces",
        description:
          "Recherche avancée d'annonces sur Deal & Co avec filtres : catégorie, localisation, fourchette de prix et tri. Chaque résultat inclut son URL sur le site.",
        inputSchema: {
          query: z.string().optional().describe("Mots-clés (optionnel)"),
          category: z
            .string()
            .optional()
            .describe(
              "Catégorie : id ('vehicules') ou libellé ('Véhicules'). Voir list_categories.",
            ),
          location: z.string().optional().describe("Ville ou région, ex: 'Lyon'"),
          minPrice: z.number().nonnegative().optional().describe("Prix minimum en €"),
          maxPrice: z.number().nonnegative().optional().describe("Prix maximum en €"),
          sort: z
            .enum(SORT_VALUES)
            .optional()
            .describe("Tri : 'recent' (défaut), 'price_asc', 'price_desc'"),
          limit: z
            .number()
            .int()
            .min(1)
            .max(30)
            .optional()
            .describe("Nombre de résultats (1-30, défaut 12)"),
        },
      },
      async ({ query, category, location, minPrice, maxPrice, sort, limit }) => {
        const params: SearchParams = {};
        if (query) params.q = query;
        if (category) params.category = category;
        if (location) params.location = location;
        if (minPrice !== undefined) params.minPrice = String(minPrice);
        if (maxPrice !== undefined) params.maxPrice = String(maxPrice);
        if (sort && sort !== "recent") params.sort = sort;

        const perPage = limit ?? 12;
        const { listings, total } = await searchListingsForMcp(params, 1, perPage);

        // Lien vers la page de recherche du site (redirige l'utilisateur).
        const qs = new URLSearchParams();
        if (query) qs.set("q", query);
        if (category) qs.set("category", category);
        if (location) qs.set("location", location);
        if (minPrice !== undefined) qs.set("minPrice", String(minPrice));
        if (maxPrice !== undefined) qs.set("maxPrice", String(maxPrice));
        // Page de recherche du site (sort non inclus : libellés différents côté UI).
        const searchUrl = `${SITE_BASE_URL}/search${qs.toString() ? `?${qs}` : ""}`;

        return jsonContent({ listings, total, searchUrl });
      },
    );

    // ─── Catégories ──────────────────────────────────────────────────────
    server.registerTool(
      "list_categories",
      {
        title: "Lister les catégories",
        description:
          "Liste les catégories d'annonces disponibles sur Deal & Co, avec leurs sous-catégories.",
        inputSchema: {},
      },
      async () => {
        return jsonContent({
          categories: CATEGORIES.map((c) => ({
            id: c.id,
            label: c.label,
            subcategories: c.subcategories,
            url: `${SITE_BASE_URL}/search?category=${encodeURIComponent(c.id)}`,
          })),
        });
      },
    );

    // ─── Détail (alias riche de fetch) ───────────────────────────────────
    server.registerTool(
      "get_listing",
      {
        title: "Détail complet d'une annonce",
        description:
          "Récupère le détail complet d'une annonce Deal & Co (métadonnées véhicule/immobilier, images, vendeur) par son id.",
        inputSchema: {
          id: z.string().describe("Identifiant de l'annonce"),
        },
      },
      async ({ id }) => {
        const listing = await getListingForMcp(id);
        if (!listing) {
          return jsonContent({ error: "Annonce introuvable ou non disponible", id });
        }
        return jsonContent(listing);
      },
    );
  },
  {
    serverInfo: { name: "deal-and-company", version: "1.0.0" },
  },
  {
    basePath: "/api",
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV !== "production",
  },
);

export { handler as GET, handler as POST, handler as DELETE };

import { NextResponse } from "next/server";
import {
  PRO_CATALOG,
  PRO_CATALOG_VERSION,
  PRO_COHERENCE_POLICY,
  PRO_DOMAINS,
  PRO_FIELD_DEFINITIONS,
  categoryIdOf,
  checkProCoherence,
  getProCategory,
  getProLeaf,
  proCategoriesForDomain,
  proCategoryOutline,
  resolveProFields,
} from "@/lib/pro-catalog";

export const runtime = "nodejs";

/**
 * Catalogue de prestations PRO servi au web et au mobile.
 *
 * L'arbre complet fait 2,3 Mo : on ne le renvoie jamais d'un bloc. Chaque vue
 * ne descend que d'un niveau, l'app charge les feuilles à l'ouverture d'une
 * catégorie. Pour la recherche tapée, voir `/api/taxonomy/pro/suggest`.
 *
 * - `?view=outline` (défaut) : catégories + sous-catégories, sans les feuilles.
 * - `?view=category&id=C08` : une catégorie avec toutes ses prestations.
 * - `?view=leaf&id=C08.S01.L003` : une prestation + ses champs résolus.
 * - `?view=fields` : les 73 définitions de champs.
 * - `?view=domains` : les domaines d'activité + la politique de cohérence.
 * - `?view=coherence&domain=transport&secondary=auto&node=C01` : verdict
 *   allow / review / block, et le catalogue filtré du domaine.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "outline";
  const id = url.searchParams.get("id") ?? "";

  const meta = {
    version: PRO_CATALOG_VERSION,
    generatedAt: PRO_CATALOG.generated_at,
    stats: PRO_CATALOG.stats,
  };

  switch (view) {
    case "outline":
      return cached({ ...meta, categories: proCategoryOutline() });

    case "category": {
      const category = getProCategory(categoryIdOf(id));
      if (!category) return NextResponse.json({ error: "Catégorie inconnue" }, { status: 404 });
      return cached({ ...meta, category });
    }

    case "leaf": {
      const leaf = getProLeaf(id);
      if (!leaf) return NextResponse.json({ error: "Prestation inconnue" }, { status: 404 });
      return cached({ ...meta, leaf, fields: resolveProFields(leaf.fields) });
    }

    case "fields":
      return cached({ ...meta, fields: PRO_FIELD_DEFINITIONS });

    case "domains":
      return cached({ ...meta, domains: PRO_DOMAINS, coherencePolicy: PRO_COHERENCE_POLICY });

    case "coherence": {
      const main = url.searchParams.get("domain") ?? "";
      const secondary = (url.searchParams.get("secondary") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const node = url.searchParams.get("node") ?? "";
      if (!main || !node) {
        return NextResponse.json({ error: "Paramètres `domain` et `node` requis" }, { status: 400 });
      }
      const selection = { main, secondary };
      const scope = proCategoriesForDomain(selection);
      return cached({
        ...meta,
        ...checkProCoherence(selection, node),
        allowedCategories: scope.allowed.map((c) => ({ id: c.id, label: c.label })),
        adjacentCategories: scope.adjacent.map((c) => ({ id: c.id, label: c.label })),
      });
    }

    default:
      return NextResponse.json({ error: `Vue inconnue : ${view}` }, { status: 400 });
  }
}

/**
 * Référentiel régénéré à la main : un cache long est sans risque, et la version
 * du catalogue change à chaque build si jamais il faut invalider.
 */
function cached(body: unknown) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
  });
}

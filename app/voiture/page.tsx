/**
 * Hub `/voiture` — la porte d'entrée qui manquait aux pages voiture.
 *
 * ── Ce que le crawl a mesuré ──────────────────────────────────────────────
 *
 * L'exploration en largeur du 28/08 (profondeur 4 depuis l'accueil, 497 pages
 * atteintes) a trouvé les quatre pages `/voiture/*-occasion` qui répondent 200
 * — hybride, diesel, essence, berline — **toutes les quatre orphelines**. Pas
 * une de moins, pas une de plus : ce n'est pas une omission au cas par cas,
 * c'est une propriété de leur maillage.
 *
 * La cause est un circuit fermé. Le seul émetteur de liens vers un cluster
 * était le bloc « Explorer d'autres types de véhicules » de
 * `app/voiture/[slug]/page.tsx`, c'est-à-dire une autre page cluster. Les
 * clusters éligibles se liaient donc entre eux, en cercle, sans qu'aucun lien
 * ne vienne du reste du site. Un crawler ne trouve pas ce cercle : il n'en
 * connaît aucun sommet. Le sitemap les annonçait, ce qui ne compense rien —
 * une URL découverte par le seul sitemap est traitée comme un cul-de-sac.
 *
 * ── Ce que cette page fait ────────────────────────────────────────────────
 *
 * Elle donne au cercle un sommet, atteignable en un clic depuis le pied de
 * page, donc depuis n'importe quelle page du site. Elle reprend exactement la
 * forme de ses deux sœurs, `/comparatif` et `/voiture-budget`, qui résolvent le
 * même problème pour leurs propres familles.
 *
 * Elle héberge aussi le maillage par marque. C'est le second orphelinat relevé
 * le 28/08 : Ford, Land Rover et Volvo répondaient 200 sans être citées nulle
 * part, parce que l'unique émetteur de liens marque exigeait trois annonces
 * indexables là où la page n'en réclame qu'une pour exister. Le juge est
 * désormais `brandHasStock` — voir sa justification dans `lib/seo/inventory.ts`.
 *
 * ── La règle qui gouverne chaque lien d'ici ───────────────────────────────
 *
 * Aucun bloc ne recopie une liste. `/voiture/{slug}` refuse de s'afficher sous
 * trois annonces et appelle `notFound()` ; l'éligibilité est donc demandée à
 * `getEditorialEligibility()`, le même juge que le sitemap. Un bloc dont le
 * filtre ne laisse rien disparaît avec son titre : un intitulé au-dessus du
 * vide se lit comme une page cassée, alors que le stock est simplement maigre.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { CAR_BRANDS } from "@/lib/carBrands";
import { getEditorialEligibility, VOITURE_CLUSTER_MATCH } from "@/lib/seo/editorial";
import { brandHasStock, getSeoInventory, slugifyValue } from "@/lib/seo/inventory";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";

const BASE = "https://www.dealandcompany.fr";

export const revalidate = 86400;

/**
 * Plafond du bloc marques. Le référentiel en compte une quarantaine et le
 * filtre de stock en laisse passer beaucoup moins, mais un plafond explicite
 * évite qu'une reprise du référentiel transforme cette page en annuaire de
 * cent liens sans que personne ne le décide.
 */
const MAX_BRANDS = 30;

export const metadata: Metadata = {
  title: "Voiture d'occasion entre particuliers",
  description:
    "Toutes les voitures d'occasion de Deal&Co, par type de motorisation et de carrosserie, par marque et par budget. Annonces entre particuliers, sans commission.",
  alternates: { canonical: `${BASE}/voiture` },
};

const BRAND_NAME_BY_SLUG = new Map(CAR_BRANDS.map((b) => [slugifyValue(b.name), b.name]));

export default async function VoitureHubPage() {
  const [editorial, inv] = await Promise.all([
    getEditorialEligibility(),
    // Panne base : le bloc marques disparaît, les clusters restent. Mieux vaut
    // une page amputée qu'une page qui devine.
    getSeoInventory().catch(() => null),
  ]);

  const eligibleClusters = new Set(editorial.clusters);
  const clusters = VOITURE_CLUSTER_MATCH.filter((c) => eligibleClusters.has(c.slug));

  const brands = inv
    ? Object.entries(inv.byBrand)
        .filter(([slug]) => brandHasStock(inv, slug) && BRAND_NAME_BY_SLUG.has(slug))
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, MAX_BRANDS)
    : [];

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <Navbar />

      <main className="pt-32 pb-16 px-6 max-w-5xl mx-auto">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-outline flex items-center gap-2">
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <span className="text-on-surface font-semibold">Voiture d&apos;occasion</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-['Manrope'] mb-3">
          Voiture d&apos;occasion entre particuliers
        </h1>
        <p className="text-outline max-w-2xl leading-relaxed mb-10">
          Motorisation, carrosserie, marque ou budget : quatre façons d&apos;entrer dans les annonces
          automobiles de Deal&amp;Co, toutes publiées par des particuliers et sans commission à
          l&apos;achat.
        </p>

        {clusters.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-bold mb-4">Par motorisation et carrosserie</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {clusters.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/voiture/${c.slug}`}
                    className="flex items-center justify-between gap-3 p-5 bg-white rounded-2xl border border-slate-100 hover:border-primary hover:shadow-md transition-all"
                  >
                    <span className="font-bold text-on-surface">{c.label}</span>
                    <span className="material-symbols-outlined text-primary shrink-0">arrow_forward</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {brands.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-bold mb-4">Par marque</h2>
            <div className="flex flex-wrap gap-2">
              {brands.map(([slug, count]) => (
                <Link
                  key={slug}
                  href={`/annonces/vehicules/${slug}`}
                  className="px-4 py-2 bg-white rounded-full border border-slate-200 text-sm font-semibold hover:border-primary hover:text-primary transition-colors"
                >
                  {BRAND_NAME_BY_SLUG.get(slug)}
                  <span className="text-outline ml-1.5 font-normal tabular-nums">{count}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Les deux autres entrées de la famille voiture. Elles ont leur propre
            index, qui applique son propre filtre de stock : on pointe vers lui
            plutôt que d'en recopier ici le contenu, sous peine de faire vivre
            deux listes qui finiront par diverger. */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/voiture-budget"
            className="flex items-center justify-between gap-3 p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-primary hover:shadow-md transition-all"
          >
            <span>
              <span className="block font-bold text-on-surface">Par budget</span>
              <span className="block text-xs text-outline mt-0.5">De moins de 3 000 € à moins de 20 000 €</span>
            </span>
            <span className="material-symbols-outlined text-primary shrink-0">arrow_forward</span>
          </Link>
          <Link
            href="/comparatif"
            className="flex items-center justify-between gap-3 p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-primary hover:shadow-md transition-all"
          >
            <span>
              <span className="block font-bold text-on-surface">Comparatifs</span>
              <span className="block text-xs text-outline mt-0.5">Prix moyens et disponibilité, modèle contre modèle</span>
            </span>
            <span className="material-symbols-outlined text-primary shrink-0">arrow_forward</span>
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

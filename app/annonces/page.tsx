/**
 * Hub `/annonces` — la page chapeau qui manquait.
 *
 * La navigation, le pied de page et le sitemap pointent tous vers des pages
 * `/annonces/{catégorie}`, mais `/annonces` lui-même renvoyait 404 : le
 * maillage interne n'avait pas de colonne vertébrale, et chaque catégorie
 * vivait isolée du reste. Cette page relie catégories, sous-catégories peuplées
 * et villes actives en un seul point d'entrée.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { CATEGORIES } from "@/lib/categories";
import { FRENCH_CITIES } from "@/lib/cities";
import { slugToSubcategoryLabel } from "@/lib/seo-content";
import { getSeoInventory, isIndexable } from "@/lib/seo/inventory";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { safeJsonLd } from "@/lib/json-ld";

const BASE = "https://www.dealandcompany.fr";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Toutes les petites annonces d'occasion entre particuliers",
  description:
    "Parcourez toutes les catégories d'annonces Deal&Co : véhicules, immobilier, multimédia, maison, mode, loisirs. Achat et vente d'occasion entre particuliers, partout en France, sans commission.",
  alternates: { canonical: `${BASE}/annonces` },
};

const MAX_SUBS_PER_CATEGORY = 6;
const MAX_CITIES = 24;

export default async function AnnoncesHubPage() {
  const inv = await getSeoInventory();

  // Les catégories peuplées passent devant : ce sont elles qui portent le
  // maillage. Les vides restent visibles et cliquables — elles servent l'appel
  // à publier — mais en fin de liste et sans poids typographique.
  const categories = CATEGORIES.map((cat) => ({
    ...cat,
    count: inv.byCategory[cat.id] ?? 0,
    subs: cat.subcategories
      .map((label) => {
        const slug = Object.keys(inv.byCategorySub)
          .filter((key) => key.startsWith(`${cat.id}/`))
          .map((key) => key.split("/")[1])
          .find((s) => slugToSubcategoryLabel(cat.id, s) === label);
        return slug ? { label, slug, count: inv.byCategorySub[`${cat.id}/${slug}`] ?? 0 } : null;
      })
      .filter((s): s is { label: string; slug: string; count: number } => s !== null)
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_SUBS_PER_CATEGORY),
  })).sort((a, b) => b.count - a.count);

  const cityBySlug = new Map(FRENCH_CITIES.map((c) => [c.slug, c]));
  const activeCities = Object.entries(inv.byCity)
    .filter(([slug, count]) => isIndexable(count) && cityBySlug.has(slug))
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_CITIES);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
      { "@type": "ListItem", position: 2, name: "Annonces", item: `${BASE}/annonces` },
    ],
  };

  return (
    <div className="bg-surface text-on-surface">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }}
      />
      <Navbar />

      <main className="pt-32 pb-16 px-6 max-w-7xl mx-auto">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-outline flex items-center gap-2">
          <Link href="/" className="hover:text-primary transition-colors">
            Accueil
          </Link>
          <span>/</span>
          <span className="text-on-surface font-semibold">Annonces</span>
        </nav>

        <div className="mb-10 max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface">
            Toutes les petites annonces d&apos;occasion entre particuliers
          </h1>
          <p className="text-outline mt-3 leading-relaxed">
            {inv.total.toLocaleString("fr-FR")} annonce{inv.total > 1 ? "s" : ""} en ligne, publiée
            {inv.total > 1 ? "s" : ""} par des particuliers partout en France. Aucune commission,
            aucun intermédiaire : vous contactez directement le vendeur.
          </p>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <article
              key={cat.id}
              className="bg-white rounded-2xl border border-surface-container p-5 flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-2xl">{cat.icon}</span>
                <h2 className="text-lg font-bold text-on-surface">
                  <Link href={`/annonces/${cat.id}`} className="hover:text-primary transition-colors">
                    {cat.label}
                  </Link>
                </h2>
                <span className="ml-auto text-xs font-semibold text-outline tabular-nums">
                  {cat.count.toLocaleString("fr-FR")}
                </span>
              </div>

              {cat.subs.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {cat.subs.map((sub) => (
                    <li key={sub.slug}>
                      <Link
                        href={`/annonces/${cat.id}/${sub.slug}`}
                        className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-surface-container text-on-surface-variant hover:bg-slate-100 hover:text-primary transition-colors"
                      >
                        {sub.label} <span className="text-outline">({sub.count})</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {cat.count === 0 && (
                <p className="text-xs text-outline">
                  Aucune annonce pour le moment —{" "}
                  <Link href="/login?callbackUrl=/post" className="text-primary font-semibold">
                    soyez le premier à publier
                  </Link>
                  .
                </p>
              )}
            </article>
          ))}
        </section>

        {activeCities.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold text-on-surface mb-4">Annonces par ville</h2>
            <div className="flex flex-wrap gap-2">
              {activeCities.map(([slug, count]) => (
                <Link
                  key={slug}
                  href={`/ville/${slug}`}
                  className="px-3 py-1.5 bg-white border border-surface-container rounded-full text-xs font-semibold text-on-surface-variant hover:border-primary/40 hover:text-primary transition-colors"
                >
                  {cityBySlug.get(slug)!.name} <span className="text-outline">({count})</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-12 bg-white rounded-2xl border border-surface-container p-6 max-w-3xl">
          <h2 className="text-xl font-bold text-on-surface mb-3">Vendre sur Deal&amp;Co</h2>
          <p className="text-on-surface leading-relaxed">
            La publication est gratuite et prend deux minutes : une photo, un prix, une description.
            Votre annonce est vérifiée puis mise en ligne, et les acheteurs vous écrivent directement
            via la messagerie du site — votre numéro de téléphone reste masqué tant que vous ne
            décidez pas de le partager.
          </p>
          <Link
            href="/login?callbackUrl=/post"
            className="inline-flex items-center gap-2 mt-5 px-6 py-3 bg-primary text-white rounded-full font-bold hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-lg">add_circle</span>
            Déposer une annonce gratuite
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

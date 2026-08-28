/**
 * Annuaire `/pro` — la page chapeau qui manquait aux fiches professionnelles.
 *
 * ── Pourquoi elle existe ──────────────────────────────────────────────────
 *
 * Les fiches pro sont, de l'aveu du sitemap lui-même, les meilleures pages du
 * domaine : adresse réelle, horaires, carte de prestations tarifées, SIRET
 * contrôlé, données structurées `LocalBusiness`. Elles sont annoncées à Google
 * avec une priorité supérieure à celle des annonces.
 *
 * Et **aucun lien du site n'y menait**. `/pro/{slug}` n'existait qu'en route
 * dynamique ; `/pro` répondait 404. Le crawl du 28/08 les a donc toutes
 * trouvées orphelines. Une page découverte par le seul sitemap est traitée
 * comme un cul-de-sac : annoncée, rarement explorée, jamais renforcée par un
 * lien interne. C'est le pire endroit du site où laisser ses meilleures pages.
 *
 * ── Le filtre ─────────────────────────────────────────────────────────────
 *
 * Aucun. Enfin : aucun *ici*. La liste est celle de `getSeoInventory()`, qui
 * applique déjà la seule condition qui vaille — fiche publiée **et**
 * habilitation professionnelle accordée, compte non banni. Refaire une requête
 * dans cette page reviendrait à créer un second juge pour la même famille
 * d'URL, et à garantir qu'un jour l'annuaire et le sitemap ne diront plus la
 * même chose. Ils lisent le même instantané, invalidé par le même tag.
 *
 * ── Quand la liste est vide ───────────────────────────────────────────────
 *
 * La page reste servie — elle porte un appel à créer sa fiche, qui est sa
 * seconde raison d'être — mais passe en `noindex, follow` et sort du sitemap
 * (`app/sitemap.ts`). Un annuaire sans professionnel n'a rien à proposer à
 * Google ; le lui annoncer quand même est exactement le mensonge que
 * `getEditorialEligibility()` a supprimé du côté éditorial.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { getSeoInventory } from "@/lib/seo/inventory";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { safeJsonLd } from "@/lib/json-ld";

const BASE = "https://www.dealandcompany.fr";

export const revalidate = 86400;

const TITLE = "Annuaire des professionnels";
const DESCRIPTION =
  "Les établissements professionnels vérifiés de Deal&Co : adresse, horaires, prestations et prise de rendez-vous en ligne.";

export async function generateMetadata(): Promise<Metadata> {
  const inv = await getSeoInventory().catch(() => null);
  const count = inv?.proProfiles.length ?? 0;

  return {
    title: count > 0 ? `${TITLE} — ${count} établissement${count > 1 ? "s" : ""} vérifié${count > 1 ? "s" : ""}` : TITLE,
    description: DESCRIPTION,
    alternates: { canonical: `${BASE}/pro` },
    // Voir l'en-tête : un annuaire vide ne réclame pas son indexation, mais
    // ses liens — l'appel à créer une fiche — restent suivis.
    robots: count > 0 ? undefined : { index: false, follow: true },
  };
}

export default async function ProDirectoryPage() {
  // Panne base : la liste est vide, la page se rabat sur son appel à créer une
  // fiche. Elle ne devine jamais un annuaire.
  const inv = await getSeoInventory().catch(() => null);

  const pros = [...(inv?.proProfiles ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name, "fr"),
  );

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
      { "@type": "ListItem", position: 2, name: TITLE, item: `${BASE}/pro` },
    ],
  };

  const itemListLd =
    pros.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: TITLE,
          url: `${BASE}/pro`,
          numberOfItems: pros.length,
          itemListElement: pros.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${BASE}${p.path}`,
            name: p.name,
          })),
        }
      : null;

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }} />
      {itemListLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListLd) }} />
      )}
      <Navbar />

      <main className="pt-32 pb-16 px-6 max-w-5xl mx-auto">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-outline flex items-center gap-2">
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <span className="text-on-surface font-semibold">Professionnels</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-['Manrope'] mb-3">
          {TITLE}
        </h1>
        <p className="text-outline max-w-2xl leading-relaxed mb-10">
          Chaque établissement listé ici a fourni un numéro SIRET contrôlé par notre équipe. Sa fiche
          porte son adresse, ses horaires et sa carte de prestations tarifée — et, quand
          l&apos;établissement l&apos;a activée, la prise de rendez-vous en ligne.
        </p>

        {pros.length > 0 ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pros.map((pro) => (
              <li key={pro.path}>
                <Link
                  href={pro.path}
                  className="flex items-center justify-between gap-3 p-5 bg-white rounded-2xl border border-slate-100 hover:border-primary hover:shadow-md transition-all"
                >
                  <span>
                    <span className="block font-bold text-on-surface">{pro.name}</span>
                    {pro.city && (
                      <span className="block text-xs text-outline mt-0.5">{pro.city}</span>
                    )}
                  </span>
                  <span className="material-symbols-outlined text-primary shrink-0">arrow_forward</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center">
            <p className="font-bold text-on-surface">Aucun établissement vérifié pour le moment.</p>
            <p className="mt-2 text-sm text-outline">
              L&apos;habilitation professionnelle demande un SIRET et une pièce justificative. Elle est
              gratuite.
            </p>
            <Link
              href="/register"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
            >
              Créer un compte professionnel
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

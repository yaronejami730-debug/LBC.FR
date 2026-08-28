import Link from "next/link";
import Icon from "@/components/Icon";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { safeJsonLd } from "@/lib/json-ld";
import { getIndexablePriceSlugs } from "@/lib/seo/price";
import {
  COMPARATIF_MATCH,
  EDITORIAL_THRESHOLDS,
  getEditorialEligibility,
} from "@/lib/seo/editorial";

const BASE = "https://www.dealandcompany.fr";

export const revalidate = 3600;
export const dynamicParams = false;

/**
 * La liste des comparatifs vit dans `lib/seo/editorial.ts`.
 *
 * Elle était recopiée ici sous le nom `PAIRS`, et le sitemap lisait l'autre
 * exemplaire. Un seul juge par famille d'URL : la page et le sitemap décrivent
 * désormais les mêmes onze comparatifs, avec le même seuil de stock.
 */
const PAIRS = COMPARATIF_MATCH;

export function generateStaticParams() {
  return PAIRS.map((p) => ({ paire: p.slug }));
}

interface PairStats {
  count: number;
  avg: number;
  min: number;
  max: number;
}

async function getStats(marque: string, modele: string): Promise<PairStats> {
  const agg = await prisma.listing
    .aggregate({
      where: {
        status: "APPROVED",
        deletedAt: null,
        shadowBanned: false,
        category: "Véhicules",
        price: { gt: 0 },
        AND: [
          { metadata: { contains: marque, mode: "insensitive" } },
          { metadata: { contains: modele, mode: "insensitive" } },
        ],
      } as any,
      _avg: { price: true },
      _min: { price: true },
      _max: { price: true },
      _count: { _all: true },
    })
    .catch(() => null);

  return {
    count: agg?._count._all ?? 0,
    avg: Math.round(agg?._avg.price ?? 0),
    min: Math.round(agg?._min.price ?? 0),
    max: Math.round(agg?._max.price ?? 0),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ paire: string }>;
}): Promise<Metadata> {
  const { paire } = await params;
  const pair = PAIRS.find((p) => p.slug === paire);
  if (!pair) return {};

  const [a, b] = await Promise.all([
    getStats(pair.a.marque, pair.a.modele),
    getStats(pair.b.marque, pair.b.modele),
  ]);

  if (a.count + b.count < 6) {
    return { title: `${pair.a.label} vs ${pair.b.label}`, robots: { index: false, follow: true } };
  }

  const canonical = `${BASE}/comparatif/${paire}`;
  const title = `${pair.a.label} vs ${pair.b.label} — Comparatif occasion entre particuliers`;
  const description = `Comparatif ${pair.a.label} vs ${pair.b.label} d'occasion : prix moyens, ${a.count + b.count} annonces sur Deal&Co. Quel modèle choisir entre particuliers ?`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, siteName: "Deal&Co", type: "website", locale: "fr_FR" },
    twitter: { card: "summary_large_image", title, description },
  };
}

function priceSlug(marque: string, modele: string) {
  return `${marque} ${modele}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default async function ComparatifPage({
  params,
}: {
  params: Promise<{ paire: string }>;
}) {
  const { paire } = await params;
  const pair = PAIRS.find((p) => p.slug === paire);
  if (!pair) notFound();

  const [a, b] = await Promise.all([
    getStats(pair.a.marque, pair.a.modele),
    getStats(pair.b.marque, pair.b.modele),
  ]);

  if (a.count + b.count < EDITORIAL_THRESHOLDS.comparatif) notFound();

  const cheaper = a.avg && b.avg ? (a.avg < b.avg ? pair.a : pair.b) : null;
  const moreSupply = a.count >= b.count ? pair.a : pair.b;

  // Pages de cote réellement servies. Le lien « Cote marché » pointait vers un
  // slug forgé à la volée, sans vérifier que la page existait.
  const availableQuotes = await getIndexablePriceSlugs().catch(() => [] as string[]);

  /**
   * Comparatifs qui répondront réellement 200 aujourd'hui.
   *
   * Le bloc « Autres comparatifs » listait `PAIRS` en entier. La page cible,
   * elle, appelle `notFound()` en dessous de six annonces cumulées — si bien
   * que chacune des quatre pages vivantes émettait cinq liens vers des 404
   * (relevé du crawl du 28/08). Googlebot suit ces liens avant de découvrir
   * qu'ils ne mènent nulle part, et chaque récupération perdue est prise sur le
   * budget d'exploration des pages qui comptent.
   *
   * Même juge que le sitemap, et que la ligne `notFound()` ci-dessus.
   */
  const eligible = await getEditorialEligibility()
    .then((e) => new Set(e.comparatif))
    .catch(() => null);
  const quoteFor = (marque: string, modele: string) => {
    const slug = `${priceSlug(marque, modele)}-occasion`;
    return availableQuotes.includes(slug) ? slug : null;
  };
  const quoteSlugs = {
    a: quoteFor(pair.a.marque, pair.a.modele),
    b: quoteFor(pair.b.marque, pair.b.modele),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
      { "@type": "ListItem", position: 2, name: "Véhicules", item: `${BASE}/annonces/vehicules` },
      { "@type": "ListItem", position: 3, name: "Comparatifs", item: `${BASE}/comparatif` },
      { "@type": "ListItem", position: 4, name: `${pair.a.label} vs ${pair.b.label}`, item: `${BASE}/comparatif/${paire}` },
    ],
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `${pair.a.label} ou ${pair.b.label} : laquelle est moins chère d'occasion ?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: cheaper
            ? `D'après les annonces actives sur Deal&Co, la ${cheaper.label} affiche un prix moyen inférieur (${(cheaper === pair.a ? a : b).avg.toLocaleString("fr-FR")} €) à l'autre modèle.`
            : `Données insuffisantes pour conclure. Comparez les annonces pour vous faire une idée précise.`,
        },
      },
      {
        "@type": "Question",
        name: `Quel modèle offre le plus de choix d'occasion : ${pair.a.label} ou ${pair.b.label} ?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Sur Deal&Co, la ${moreSupply.label} dispose actuellement de ${(moreSupply === pair.a ? a : b).count} annonces actives, contre ${(moreSupply === pair.a ? b : a).count} pour l'autre modèle. Plus de choix = meilleure marge de négociation.`,
        },
      },
      {
        "@type": "Question",
        name: `Quelle est la fourchette de prix de la ${pair.a.label} d'occasion ?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: a.count > 0
            ? `Entre ${a.min.toLocaleString("fr-FR")} € et ${a.max.toLocaleString("fr-FR")} €, prix moyen ${a.avg.toLocaleString("fr-FR")} €. Basé sur ${a.count} annonces actives.`
            : `Pas assez d'annonces actives pour calculer une fourchette précise.`,
        },
      },
      {
        "@type": "Question",
        name: `Quelle est la fourchette de prix de la ${pair.b.label} d'occasion ?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: b.count > 0
            ? `Entre ${b.min.toLocaleString("fr-FR")} € et ${b.max.toLocaleString("fr-FR")} €, prix moyen ${b.avg.toLocaleString("fr-FR")} €. Basé sur ${b.count} annonces actives.`
            : `Pas assez d'annonces actives pour calculer une fourchette précise.`,
        },
      },
    ],
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqLd) }} />
      <Navbar />

      <main className="pt-32 pb-16 px-6 max-w-5xl mx-auto">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-outline flex items-center gap-2">
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <Link href="/annonces/vehicules" className="hover:text-primary transition-colors">Véhicules</Link>
          <span>/</span>
          <span className="text-on-surface font-semibold">{pair.a.label} vs {pair.b.label}</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-['Manrope'] mb-3">
          {pair.a.label} <span className="text-outline">vs</span> {pair.b.label}
        </h1>
        <p className="text-outline mb-10">
          Comparatif occasion entre particuliers — {(a.count + b.count).toLocaleString("fr-FR")} annonces analysées
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
          <PairCard model={pair.a} stats={a} winner={cheaper === pair.a} quoteSlug={quoteSlugs.a} />
          <PairCard model={pair.b} stats={b} winner={cheaper === pair.b} quoteSlug={quoteSlugs.b} />
        </div>

        <section className="bg-white rounded-2xl border border-slate-100 p-6 mb-10">
          <h2 className="text-xl font-bold mb-4">Verdict prix</h2>
          {cheaper ? (
            <p className="leading-relaxed text-on-surface-variant">
              Sur le marché de l&apos;occasion entre particuliers, la <strong>{cheaper.label}</strong> affiche un prix moyen de <strong>{(cheaper === pair.a ? a : b).avg.toLocaleString("fr-FR")} €</strong>, contre <strong>{(cheaper === pair.a ? b : a).avg.toLocaleString("fr-FR")} €</strong> pour la {(cheaper === pair.a ? pair.b : pair.a).label}. L&apos;écart représente environ <strong>{Math.abs(a.avg - b.avg).toLocaleString("fr-FR")} €</strong>.
            </p>
          ) : (
            <p className="text-outline">Pas assez d&apos;annonces pour conclure sur le prix moyen.</p>
          )}
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">Questions fréquentes</h2>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
            {(faqLd.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>).map((q, i) => (
              <details key={i} className="group p-5 open:bg-slate-50/40">
                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none">
                  <h3 className="font-bold text-on-surface text-[15px] leading-snug">{q.name}</h3>
                  <Icon name="expand_more" className="material-symbols-outlined text-slate-400 text-xl transition-transform group-open:rotate-180 shrink-0" />
                </summary>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">{q.acceptedAnswer.text}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="bg-slate-50 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-3">Autres comparatifs</h2>
          <div className="flex flex-wrap gap-2">
            {PAIRS.filter((p) => p.slug !== paire && (eligible?.has(p.slug) ?? true))
              .slice(0, 8)
              .map((p) => (
              <Link
                key={p.slug}
                href={`/comparatif/${p.slug}`}
                className="px-4 py-2 bg-white rounded-full border border-slate-200 text-sm font-semibold hover:border-primary hover:text-primary transition-colors"
              >
                {p.a.label} vs {p.b.label}
              </Link>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

/**
 * `quoteSlug` est nul quand la page de cote correspondante n'a pas assez
 * d'observations pour exister — elle répondrait 404. Le bloc disparaît alors :
 * un lien mort depuis une page éditoriale coûte deux fois, en budget
 * d'exploration et en confiance.
 */
function PairCard({ model, stats, winner, quoteSlug }: { model: { marque: string; modele: string; label: string }; stats: PairStats; winner: boolean; quoteSlug: string | null }) {
  return (
    <article className={`rounded-2xl p-6 border ${winner ? "border-primary bg-primary/5" : "border-slate-100 bg-white"}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-extrabold">{model.label}</h2>
        {winner && (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-white rounded-full text-xs font-bold">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            Plus accessible
          </span>
        )}
      </div>
      <dl className="space-y-2 text-sm mb-5">
        <Row label="Annonces actives" value={stats.count > 0 ? stats.count.toLocaleString("fr-FR") : "—"} />
        <Row label="Prix moyen" value={stats.avg > 0 ? `${stats.avg.toLocaleString("fr-FR")} €` : "—"} bold />
        <Row label="Prix minimum" value={stats.min > 0 ? `${stats.min.toLocaleString("fr-FR")} €` : "—"} />
        <Row label="Prix maximum" value={stats.max > 0 ? `${stats.max.toLocaleString("fr-FR")} €` : "—"} />
      </dl>
      {quoteSlug && (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/prix/${quoteSlug}`}
            className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
          >
            Cote marché {model.label}
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
      )}
    </article>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-outline">{label}</dt>
      <dd className={bold ? "font-extrabold text-on-surface" : "font-semibold text-on-surface"}>{value}</dd>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { listingUrl } from "@/lib/listing-slug";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";
import ListingCard from "@/components/home/ListingCard";

const BASE = "https://www.dealandcompany.fr";

export const revalidate = 3600;
export const dynamicParams = false;

interface BudgetDef {
  slug: string;
  min: number;
  max: number;
  label: string;
  intro: string;
  faq: { q: string; a: string }[];
}

const BUDGETS: BudgetDef[] = [
  {
    slug: "moins-de-3000-euros",
    min: 1,
    max: 3000,
    label: "Voiture moins de 3 000 €",
    intro: "Petit budget, premier achat ou voiture seconde. Citadines, vieilles berlines, modèles 10 à 20 ans d'âge. Privilégiez kilométrage maîtrisé et contrôle technique frais.",
    faq: [
      { q: "Peut-on trouver une voiture fiable à moins de 3 000 € ?", a: "Oui, mais le marché est tendu. Privilégiez les citadines Dacia, Renault, Peugeot des années 2005-2012 avec entretien suivi. Demandez systématiquement le rapport HistoVec et le contrôle technique récent." },
      { q: "Quel kilométrage maximum acceptable à ce prix ?", a: "Jusqu'à 180-200 000 km si l'entretien est documenté. Au-delà, prévoyez du budget pour distribution, embrayage, suspensions." },
    ],
  },
  {
    slug: "moins-de-5000-euros",
    min: 1,
    max: 5000,
    label: "Voiture moins de 5 000 €",
    intro: "Budget accessible pour une citadine d'occasion correcte ou une berline 8-12 ans. Marge de manœuvre pour exiger un entretien suivi et un contrôle technique récent.",
    faq: [
      { q: "Quelle voiture acheter avec 5 000 € ?", a: "Renault Clio III/IV, Peugeot 207/208, Citroën C3, Dacia Sandero offrent le meilleur rapport prix-fiabilité dans cette tranche. Évitez les diesels Crit'Air 3+ si vous vivez en ZFE." },
      { q: "Faut-il préférer essence ou diesel à moins de 5 000 € ?", a: "Essence pour la simplicité et l'accès ZFE. Diesel uniquement si > 15 000 km/an et zone hors ZFE — la rentabilité diesel s'écroule sous ce kilométrage annuel." },
    ],
  },
  {
    slug: "moins-de-8000-euros",
    min: 1,
    max: 8000,
    label: "Voiture moins de 8 000 €",
    intro: "Budget confortable pour une citadine récente (5-8 ans), une berline compacte, voire un petit SUV ancien. Bonne marge pour exiger qualité.",
    faq: [
      { q: "Quelle berline d'occasion à moins de 8 000 € ?", a: "Peugeot 308 II, Renault Mégane III/IV, Ford Focus, Toyota Auris, Volkswagen Golf VI offrent des berlines compactes encore récentes." },
      { q: "Peut-on trouver un SUV à 8 000 € ?", a: "Oui, Dacia Duster première génération, Nissan Qashqai I, Renault Kadjar de base. Évitez les premières années diesel sans FAP performant." },
    ],
  },
  {
    slug: "moins-de-12000-euros",
    min: 1,
    max: 12000,
    label: "Voiture moins de 12 000 €",
    intro: "Belle marge pour une voiture récente (3-5 ans), SUV compact, berline familiale ou citadine premium. Choix large entre essence, diesel et hybride léger.",
    faq: [
      { q: "Quel SUV à moins de 12 000 € en occasion ?", a: "Peugeot 2008 II, Renault Captur, Dacia Duster II, Citroën C3 Aircross, Nissan Juke I représentent les valeurs sûres dans cette tranche." },
      { q: "Hybride accessible à 12 000 € ?", a: "Oui — Toyota Yaris Hybrid (génération 3) et certaines Auris Hybrid se trouvent dans cette tranche avec kilométrage raisonnable." },
    ],
  },
  {
    slug: "moins-de-20000-euros",
    min: 1,
    max: 20000,
    label: "Voiture moins de 20 000 €",
    intro: "Voiture quasi-récente, SUV familial, berline premium d'entrée, hybride rechargeable d'occasion. Accès aux modèles 2-3 ans avec garantie constructeur résiduelle.",
    faq: [
      { q: "Hybride rechargeable à moins de 20 000 € ?", a: "Renault Captur E-Tech PHEV, Peugeot 3008 Hybrid, Hyundai Ioniq HEV des premières générations. Vérifiez l'état de la batterie (rapport SOH)." },
      { q: "Voiture électrique d'occasion à ce prix ?", a: "Renault Zoé R110/R135 récente, Peugeot e-208 ou Opel Corsa-e d'occasion 2-3 ans, ou même Tesla Model 3 entrée de gamme kilométrée. Bonus écologique occasion possible sous conditions." },
    ],
  },
];

export function generateStaticParams() {
  return BUDGETS.map((b) => ({ tranche: b.slug }));
}

function findBudget(slug: string): BudgetDef | undefined {
  return BUDGETS.find((b) => b.slug === slug);
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ tranche: string }>;
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { tranche } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const budget = findBudget(tranche);
  if (!budget) return {};

  const count = await prisma.listing
    .count({
      where: {
        status: "APPROVED",
        deletedAt: null,
        shadowBanned: false,
        category: "Véhicules",
        price: { gte: budget.min, lte: budget.max },
      } as any,
    })
    .catch(() => 0);

  if (count < 3) {
    return { title: budget.label, robots: { index: false, follow: true } };
  }

  const canonical = `${BASE}/voiture-budget/${tranche}`;
  const title = `${budget.label} d'occasion — ${count.toLocaleString("fr-FR")} annonces entre particuliers`;
  const description = `${count} annonces de ${budget.label.toLowerCase()} d'occasion entre particuliers en France. Sans commission sur Deal&Co.`;

  return {
    title,
    description,
    alternates: { canonical },
    robots: page > 1 ? { index: false, follow: true } : undefined,
    openGraph: { title, description, url: canonical, siteName: "Deal&Co", type: "website", locale: "fr_FR" },
    twitter: { card: "summary_large_image", title, description },
  };
}

const PER_PAGE = 24;

export default async function VoitureBudgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ tranche: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { tranche } = await params;
  const { page: pageParam } = await searchParams;
  const budget = findBudget(tranche);
  if (!budget) notFound();

  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const skip = (page - 1) * PER_PAGE;

  const where = {
    status: "APPROVED",
    deletedAt: null,
    shadowBanned: false,
    category: "Véhicules",
    price: { gte: budget.min, lte: budget.max },
  };

  const [listings, agg, total] = await Promise.all([
    prisma.listing.findMany({
      where: where as any,
      orderBy: [{ isPremium: "desc" }, { createdAt: "desc" }],
      take: PER_PAGE,
      skip,
      select: { id: true, title: true, price: true, location: true, images: true, createdAt: true, isPremium: true },
    }),
    prisma.listing.aggregate({
      where: where as any,
      _avg: { price: true },
      _min: { price: true },
      _max: { price: true },
    }),
    prisma.listing.count({ where: where as any }),
  ]);

  if (total < 3) notFound();

  const avg = Math.round(agg._avg.price ?? 0);
  const min = Math.round(agg._min.price ?? 0);
  const max = Math.round(agg._max.price ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
      { "@type": "ListItem", position: 2, name: "Véhicules", item: `${BASE}/annonces/vehicules` },
      { "@type": "ListItem", position: 3, name: budget.label, item: `${BASE}/voiture-budget/${tranche}` },
    ],
  };

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: budget.label,
    url: `${BASE}/voiture-budget/${tranche}`,
    numberOfItems: total,
    itemListElement: listings.slice(0, 10).map((l, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE}${listingUrl(l.id, l.title)}`,
      name: l.title,
    })),
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: budget.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen mb-24 md:mb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <Navbar />

      <main className="pt-32 pb-16 px-6 max-w-5xl mx-auto">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-outline flex items-center gap-2">
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <Link href="/annonces/vehicules" className="hover:text-primary transition-colors">Véhicules</Link>
          <span>/</span>
          <span className="text-on-surface font-semibold">{budget.label}</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-['Manrope'] mb-3">
          {budget.label} d&apos;occasion
        </h1>
        <p className="text-outline mb-2">
          {total.toLocaleString("fr-FR")} annonces entre particuliers
        </p>
        <p className="text-sm text-on-surface-variant max-w-3xl leading-relaxed mb-10">
          {budget.intro}
        </p>

        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { label: "Prix minimum", value: min },
            { label: "Prix moyen", value: avg, highlight: true },
            { label: "Prix maximum", value: max },
          ].map((s) => (
            <div
              key={s.label}
              className={`rounded-2xl border p-5 text-center ${
                s.highlight ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-white border-surface-container"
              }`}
            >
              <p className={`text-2xl font-extrabold font-['Manrope'] ${s.highlight ? "text-white" : "text-primary"}`}>
                {s.value.toLocaleString("fr-FR")} €
              </p>
              <p className={`text-sm mt-1 ${s.highlight ? "text-white/80" : "text-outline"}`}>{s.label}</p>
            </div>
          ))}
        </div>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">Annonces {budget.label.toLowerCase()}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
              {page > 1 && (
                <Link
                  href={`/voiture-budget/${tranche}?page=${page - 1}`}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold hover:bg-slate-50"
                >
                  ← Précédent
                </Link>
              )}
              <span className="px-4 py-2 text-sm text-outline">Page {page} / {totalPages}</span>
              {page < totalPages && (
                <Link
                  href={`/voiture-budget/${tranche}?page=${page + 1}`}
                  className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold"
                >
                  Suivant →
                </Link>
              )}
            </nav>
          )}
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">Questions fréquentes</h2>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
            {budget.faq.map((f, i) => (
              <details key={i} className="group p-5 open:bg-slate-50/40">
                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none">
                  <h3 className="font-bold text-on-surface text-[15px] leading-snug">{f.q}</h3>
                  <span className="material-symbols-outlined text-slate-400 text-xl transition-transform group-open:rotate-180 shrink-0">
                    expand_more
                  </span>
                </summary>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="bg-slate-50 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-3">Autres tranches de budget</h2>
          <div className="flex flex-wrap gap-2">
            {BUDGETS.filter((b) => b.slug !== tranche).map((b) => (
              <Link
                key={b.slug}
                href={`/voiture-budget/${b.slug}`}
                className="px-4 py-2 bg-white rounded-full border border-slate-200 text-sm font-semibold hover:border-primary hover:text-primary transition-colors"
              >
                {b.label}
              </Link>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
      <BottomNav />
    </div>
  );
}

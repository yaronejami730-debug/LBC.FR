import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { listingUrl } from "@/lib/listing-slug";
import { formatDistanceToNow } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";

const BASE = "https://www.dealandcompany.fr";

export const revalidate = 3600;
export const dynamicParams = false;

type ClusterKind = "fuel" | "body";

interface ClusterDef {
  slug: string;
  label: string;
  intro: string;
  kind: ClusterKind;
  match: string[];
  faq: { q: string; a: string }[];
}

const CLUSTERS: ClusterDef[] = [
  {
    slug: "electrique-occasion",
    label: "Voiture électrique occasion",
    intro: "Voitures 100% électriques d'occasion entre particuliers. Crit'Air 0, accès libre aux ZFE, recharge à domicile et bonus écologique selon profil.",
    kind: "fuel",
    match: ["Électrique", "Electrique", "Electric"],
    faq: [
      {
        q: "Quels sont les avantages d'acheter une voiture électrique d'occasion ?",
        a: "Vignette Crit'Air 0, accès illimité aux Zones à Faibles Émissions (Paris, Lyon, Grenoble…), coût d'usage 2 à 3 fois inférieur au thermique, entretien réduit (pas d'embrayage, vidange, courroie). Le bonus écologique reste disponible pour certains véhicules d'occasion sous conditions.",
      },
      {
        q: "Combien coûte une recharge à domicile ?",
        a: "Compter environ 2 à 4 € pour 100 km en charge domestique (heures creuses), contre 8 à 12 € pour un véhicule essence équivalent. Une borne murale 7,4 kW se négocie autour de 800 à 1 200 €, installation comprise.",
      },
      {
        q: "L'autonomie d'une voiture électrique d'occasion baisse-t-elle avec le temps ?",
        a: "Oui légèrement — la dégradation typique est de 1 à 2% par an. Une batterie à 80% de sa capacité initiale après 8 ans reste tout à fait fonctionnelle. Demandez le rapport SOH (State of Health) au vendeur avant achat.",
      },
    ],
  },
  {
    slug: "hybride-occasion",
    label: "Voiture hybride occasion",
    intro: "Voitures hybrides (HEV) et hybrides rechargeables (PHEV) d'occasion. Consommation réduite, Crit'Air 1, idéal pour usage mixte ville et longs trajets.",
    kind: "fuel",
    match: ["Hybride", "Hybrid", "Hybride rechargeable", "PHEV", "HEV"],
    faq: [
      {
        q: "Quelle différence entre hybride et hybride rechargeable ?",
        a: "Un hybride classique (HEV) recharge sa batterie en roulant et en freinant. Un hybride rechargeable (PHEV) se branche sur secteur et offre 40 à 80 km en mode 100% électrique avant de basculer sur le thermique.",
      },
      {
        q: "L'hybride consomme-t-elle vraiment moins ?",
        a: "En ville et trajet mixte, oui — souvent 30 à 40% de moins qu'un thermique équivalent. Sur autoroute à vitesse constante, le gain est plus modeste (10 à 15%).",
      },
      {
        q: "Quelle est la durée de vie de la batterie hybride ?",
        a: "Les batteries hybrides sont conçues pour la durée de vie du véhicule (8 à 15 ans selon usage). La plupart des constructeurs garantissent la batterie 8 ans / 160 000 km. Demandez l'historique de remplacement éventuel.",
      },
    ],
  },
  {
    slug: "diesel-occasion",
    label: "Voiture diesel occasion",
    intro: "Voitures diesel d'occasion entre particuliers. Idéal grands rouleurs (>15 000 km/an), couple élevé et autonomie. Attention aux restrictions ZFE selon Crit'Air.",
    kind: "fuel",
    match: ["Diesel", "Gazole"],
    faq: [
      {
        q: "Le diesel est-il encore intéressant en 2026 ?",
        a: "Oui pour les gros rouleurs (>15 000 km/an) hors ZFE. La consommation reste inférieure à l'essence en parcours autoroutier et l'autonomie est plus élevée. Vérifiez la vignette Crit'Air avant d'acheter — Crit'Air 3, 4 et 5 sont progressivement interdits en zone urbaine.",
      },
      {
        q: "Quelles villes interdisent le diesel ?",
        a: "Les ZFE-m (Zones à Faibles Émissions Mobilité) restreignent les véhicules les plus polluants : Paris, Lyon, Grenoble, Marseille, Strasbourg, Rouen, Reims, Toulouse, Nice, Montpellier. Le calendrier s'accélère : un diesel Crit'Air 3 sera bientôt interdit à Paris.",
      },
      {
        q: "Quels sont les défauts récurrents d'un diesel d'occasion ?",
        a: "FAP encrassé sur usage urbain court, vanne EGR encrassée, injecteurs (BMW, Renault), turbo (Peugeot HDi). Demandez factures d'entretien, contrôle technique récent et historique kilométrique cohérent.",
      },
    ],
  },
  {
    slug: "essence-occasion",
    label: "Voiture essence occasion",
    intro: "Voitures essence d'occasion. Choix le plus large, prix d'entrée bas, entretien simple. Convient aux petits rouleurs et trajets mixtes.",
    kind: "fuel",
    match: ["Essence", "Sans plomb", "SP95", "SP98"],
    faq: [
      {
        q: "Essence ou diesel pour un usage urbain ?",
        a: "Essence — plus simple à entretenir (pas de FAP qui s'encrasse), plus accessible et mieux toléré par les ZFE pour les Crit'Air 1 et 2. Le diesel n'est rentable qu'au-delà de 15 à 20 000 km/an.",
      },
      {
        q: "Quelle est la durée de vie d'un moteur essence ?",
        a: "300 000 km couramment atteints avec un entretien régulier. Surveillez la courroie de distribution (changée tous les 90 à 150 000 km selon constructeur), le démarreur et la pompe à eau.",
      },
    ],
  },
  {
    slug: "suv-occasion",
    label: "SUV occasion",
    intro: "SUV d'occasion entre particuliers — compacts, familiaux, premium. Position de conduite haute, volume de coffre généreux, polyvalence ville et longs trajets.",
    kind: "body",
    match: ["SUV", "Crossover", "4x4", "4X4"],
    faq: [
      {
        q: "SUV ou berline pour la famille ?",
        a: "Le SUV offre plus de hauteur, une assise rehaussée et un coffre généralement plus accessible. La berline reste plus efficiente sur autoroute (consommation et Cx). Pour 5 places + 2 enfants, un SUV compact suffit largement.",
      },
      {
        q: "Quel SUV d'occasion fiable en 2026 ?",
        a: "Toyota RAV4, Honda CR-V, Mazda CX-5 trônent en tête des classements fiabilité. En français, le Peugeot 3008 et le Renault Kadjar offrent un bon compromis. Évitez les premières générations diesel sans FAP.",
      },
    ],
  },
  {
    slug: "berline-occasion",
    label: "Berline occasion",
    intro: "Berlines d'occasion — confort longue distance, dynamisme et consommation maîtrisée. Compactes, familiales ou premium.",
    kind: "body",
    match: ["Berline", "Sedan"],
    faq: [
      {
        q: "Quelle berline d'occasion à moins de 10 000 € ?",
        a: "Peugeot 308, Renault Mégane IV, Volkswagen Golf VII, Toyota Corolla et Ford Focus offrent d'excellentes berlines compactes autour de 7 à 12 000 € en occasion récente.",
      },
    ],
  },
  {
    slug: "citadine-occasion",
    label: "Citadine occasion",
    intro: "Petites voitures citadines d'occasion — idéal premier achat, parking facile en ville, consommation et entretien réduits.",
    kind: "body",
    match: ["Citadine", "Mini", "Petite"],
    faq: [
      {
        q: "Quelle citadine d'occasion choisir ?",
        a: "Les valeurs sûres : Renault Clio, Peugeot 208, Citroën C3, Toyota Yaris. Pour le minimum budget, Dacia Sandero. Pour le premium : Mini Cooper, Audi A1.",
      },
    ],
  },
  {
    slug: "break-occasion",
    label: "Break occasion",
    intro: "Breaks d'occasion — volume de coffre maximal, parfait pour les familles nombreuses, les longs trajets et le transport d'équipement.",
    kind: "body",
    match: ["Break", "Estate", "Touring", "Variant", "Avant", "SW"],
    faq: [
      {
        q: "Break ou SUV pour la famille ?",
        a: "Break = consommation 15 à 20% inférieure à SUV équivalent, comportement plus dynamique, coffre souvent plus long. SUV = position haute, accès facilité. Le break reste imbattable sur le rapport volume / consommation.",
      },
    ],
  },
];

export function generateStaticParams() {
  return CLUSTERS.map((c) => ({ slug: c.slug }));
}

function findCluster(slug: string): ClusterDef | undefined {
  return CLUSTERS.find((c) => c.slug === slug);
}

function buildWhere(cluster: ClusterDef): Record<string, unknown> {
  const orClauses = cluster.match.flatMap((m) => [
    { metadata: { contains: `"${cluster.kind === "fuel" ? "carburant" : "typeVehicule"}":"${m}"`, mode: "insensitive" } },
  ]);
  return {
    status: "APPROVED",
    deletedAt: null,
    shadowBanned: false,
    category: "Véhicules",
    price: { gt: 0 },
    OR: orClauses,
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const cluster = findCluster(slug);
  if (!cluster) return {};

  const where = buildWhere(cluster);
  const count = await prisma.listing.count({ where: where as any }).catch(() => 0);
  if (count < 3) {
    return { title: cluster.label, robots: { index: false, follow: true } };
  }

  const canonical = `${BASE}/voiture/${slug}`;
  const title = `${cluster.label} — ${count.toLocaleString("fr-FR")} annonces entre particuliers — Deal&Co`;
  const description = `${count} annonces de ${cluster.label.toLowerCase()} entre particuliers en France. Sans commission, contact direct vendeur. Comparez les prix sur Deal&Co.`;

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

export default async function VoitureClusterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const cluster = findCluster(slug);
  if (!cluster) notFound();

  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const skip = (page - 1) * PER_PAGE;

  const where = buildWhere(cluster);

  const [listings, agg, total] = await Promise.all([
    prisma.listing.findMany({
      where: where as any,
      orderBy: [{ isPremium: "desc" }, { createdAt: "desc" }],
      take: PER_PAGE,
      skip,
      select: {
        id: true,
        title: true,
        price: true,
        location: true,
        condition: true,
        images: true,
        createdAt: true,
      },
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
      { "@type": "ListItem", position: 3, name: cluster.label, item: `${BASE}/voiture/${slug}` },
    ],
  };

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: cluster.label,
    url: `${BASE}/voiture/${slug}`,
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
    mainEntity: cluster.faq.map((f) => ({
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
          <span className="text-on-surface font-semibold">{cluster.label}</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-['Manrope'] mb-3">
          {cluster.label}
        </h1>
        <p className="text-outline mb-2">
          {total.toLocaleString("fr-FR")} annonces entre particuliers en France
        </p>
        <p className="text-sm text-on-surface-variant max-w-3xl leading-relaxed mb-10">
          {cluster.intro}
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
                s.highlight
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                  : "bg-white border-surface-container"
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
          <h2 className="text-xl font-bold mb-4">
            Annonces {cluster.label.toLowerCase()}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {listings.map((l) => {
              const images = JSON.parse(l.images) as string[];
              const img = images[0] || undefined;
              return (
                <Link
                  key={l.id}
                  href={listingUrl(l.id, l.title)}
                  className="group flex flex-col bg-white rounded-xl overflow-hidden border border-surface-container hover:shadow-md transition-all"
                >
                  <div className="relative aspect-square overflow-hidden bg-surface-container-low">
                    {img ? (
                      <Image
                        src={img}
                        alt={`${l.title} — ${l.price.toLocaleString("fr-FR")} €`}
                        fill
                        sizes="(max-width:640px) 50vw,25vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-3xl text-outline/30">image</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 flex flex-col gap-0.5">
                    <p className="text-on-surface font-semibold text-sm leading-snug line-clamp-2">{l.title}</p>
                    <p className="text-primary font-bold">{l.price.toLocaleString("fr-FR")} €</p>
                    <p className="text-outline text-xs truncate">{l.location}</p>
                    <p className="text-outline/60 text-[10px]">{formatDistanceToNow(l.createdAt)}</p>
                  </div>
                </Link>
              );
            })}
          </div>

          {totalPages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
              {page > 1 && (
                <Link
                  href={`/voiture/${slug}?page=${page - 1}`}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold hover:bg-slate-50"
                >
                  ← Précédent
                </Link>
              )}
              <span className="px-4 py-2 text-sm text-outline">Page {page} / {totalPages}</span>
              {page < totalPages && (
                <Link
                  href={`/voiture/${slug}?page=${page + 1}`}
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
            {cluster.faq.map((f, i) => (
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
          <h2 className="text-lg font-bold mb-3">Explorer d&apos;autres types de véhicules</h2>
          <div className="flex flex-wrap gap-2">
            {CLUSTERS.filter((c) => c.slug !== slug).map((c) => (
              <Link
                key={c.slug}
                href={`/voiture/${c.slug}`}
                className="px-4 py-2 bg-white rounded-full border border-slate-200 text-sm font-semibold hover:border-primary hover:text-primary transition-colors"
              >
                {c.label}
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

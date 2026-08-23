import Link from "next/link";
import type { Metadata } from "next";
import { getEditorialEligibility } from "@/lib/seo/editorial";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";

const BASE = "https://www.dealandcompany.fr";

export const revalidate = 86400;

const PAIRS = [
  { slug: "peugeot-208-vs-renault-clio",   labelA: "Peugeot 208",     labelB: "Renault Clio" },
  { slug: "citroen-c3-vs-renault-clio",    labelA: "Citroën C3",      labelB: "Renault Clio" },
  { slug: "peugeot-308-vs-renault-megane", labelA: "Peugeot 308",     labelB: "Renault Mégane" },
  { slug: "volkswagen-golf-vs-peugeot-308",labelA: "Volkswagen Golf", labelB: "Peugeot 308" },
  { slug: "dacia-sandero-vs-renault-clio", labelA: "Dacia Sandero",   labelB: "Renault Clio" },
  { slug: "toyota-yaris-vs-renault-clio",  labelA: "Toyota Yaris",    labelB: "Renault Clio" },
  { slug: "peugeot-3008-vs-renault-kadjar",labelA: "Peugeot 3008",    labelB: "Renault Kadjar" },
  { slug: "bmw-serie-3-vs-audi-a4",        labelA: "BMW Série 3",     labelB: "Audi A4" },
  { slug: "mercedes-classe-a-vs-bmw-serie-1", labelA: "Mercedes Classe A", labelB: "BMW Série 1" },
  { slug: "audi-a3-vs-bmw-serie-1",        labelA: "Audi A3",         labelB: "BMW Série 1" },
  { slug: "tesla-model-3-vs-peugeot-e-208",labelA: "Tesla Model 3",   labelB: "Peugeot e-208" },
];

export const metadata: Metadata = {
  title: "Comparatifs voitures d'occasion",
  description: "Comparatifs de voitures d'occasion entre particuliers : prix moyens, nombre d'annonces, écarts. Choisissez le bon modèle avant d'acheter.",
  alternates: { canonical: `${BASE}/comparatif` },
};

export default async function ComparatifIndexPage() {
  const eligible = new Set((await getEditorialEligibility()).comparatif);
  const pairs = PAIRS.filter((p) => eligible.has(p.slug));

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <Navbar />

      <main className="pt-32 pb-16 px-6 max-w-5xl mx-auto">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-outline flex items-center gap-2">
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <span className="text-on-surface font-semibold">Comparatifs</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-['Manrope'] mb-3">
          Comparatifs voitures d&apos;occasion
        </h1>
        <p className="text-outline max-w-2xl leading-relaxed mb-10">
          Comparez prix moyens, fourchette de prix et disponibilité entre les modèles les plus recherchés sur Deal&Co — données calculées en temps réel à partir des annonces actives entre particuliers.
        </p>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Seules les pages qui répondront 200 sont proposées.
              `/comparatif`, `/voiture` et `/voiture-budget` refusent de
              s'afficher sous un certain stock : les lister sans vérifier
              revenait à envoyer nos visiteurs — et Google — sur nos propres
              404. L'éligibilité est celle du sitemap, pas une seconde règle. */}
          {pairs.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/comparatif/${p.slug}`}
                className="flex items-center justify-between gap-3 p-5 bg-white rounded-2xl border border-slate-100 hover:border-primary hover:shadow-md transition-all"
              >
                <span className="font-bold text-on-surface">
                  {p.labelA} <span className="text-outline">vs</span> {p.labelB}
                </span>
                <span className="material-symbols-outlined text-primary shrink-0">arrow_forward</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <SiteFooter />
    </div>
  );
}

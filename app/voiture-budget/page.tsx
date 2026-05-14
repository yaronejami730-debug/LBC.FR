import Link from "next/link";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";

const BASE = "https://www.dealandcompany.fr";

export const revalidate = 86400;

const BUDGETS = [
  { slug: "moins-de-3000-euros",  label: "Moins de 3 000 €" },
  { slug: "moins-de-5000-euros",  label: "Moins de 5 000 €" },
  { slug: "moins-de-8000-euros",  label: "Moins de 8 000 €" },
  { slug: "moins-de-12000-euros", label: "Moins de 12 000 €" },
  { slug: "moins-de-20000-euros", label: "Moins de 20 000 €" },
];

export const metadata: Metadata = {
  title: "Voiture d'occasion par budget — Deal&Co",
  description: "Trouvez une voiture d'occasion entre particuliers selon votre budget : moins de 3 000, 5 000, 8 000, 12 000 ou 20 000 €.",
  alternates: { canonical: `${BASE}/voiture-budget` },
};

export default function VoitureBudgetIndexPage() {
  return (
    <div className="bg-surface text-on-surface min-h-screen mb-24 md:mb-0">
      <Navbar />

      <main className="pt-32 pb-16 px-6 max-w-5xl mx-auto">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-outline flex items-center gap-2">
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <span className="text-on-surface font-semibold">Voiture par budget</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-['Manrope'] mb-3">
          Voiture d&apos;occasion par budget
        </h1>
        <p className="text-outline max-w-2xl leading-relaxed mb-10">
          Sélectionnez votre fourchette de prix et consultez immédiatement les annonces correspondantes entre particuliers sur Deal&Co.
        </p>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BUDGETS.map((b) => (
            <li key={b.slug}>
              <Link
                href={`/voiture-budget/${b.slug}`}
                className="flex items-center justify-between gap-3 p-5 bg-white rounded-2xl border border-slate-100 hover:border-primary hover:shadow-md transition-all"
              >
                <span className="font-bold text-on-surface">{b.label}</span>
                <span className="material-symbols-outlined text-primary shrink-0">arrow_forward</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <SiteFooter />
      <BottomNav />
    </div>
  );
}

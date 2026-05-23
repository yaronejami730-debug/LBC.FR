import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";
import AIChat from "./AIChat";

const BASE = "https://www.dealandcompany.fr";

export const metadata: Metadata = {
  title: "Déborah, l'assistante IA — Trouvez l'annonce qui vous correspond | Deal&Co",
  description:
    "Déborah, l'assistante IA de Deal&Co, vous guide en quelques questions pour trouver l'annonce parfaite : voiture d'occasion, appartement, mobilier… Tout devient simple.",
  alternates: { canonical: `${BASE}/ai` },
  openGraph: {
    title: "Déborah, l'assistante IA — Deal&Co",
    description: "Trouvez l'annonce parfaite en quelques questions avec Déborah.",
    url: `${BASE}/ai`,
    siteName: "Deal&Co",
    locale: "fr_FR",
    type: "website",
  },
};

export default function AIPage() {
  return (
    <div className="bg-surface text-on-surface min-h-screen mb-24 md:mb-0">
      <Navbar />

      <main className="pt-28 md:pt-32 pb-12 px-4 max-w-3xl mx-auto">
        <header className="mb-7 text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[#2f6fb8]/12 to-[#7b3fd6]/12 text-[#2f6fb8] text-[11px] font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            Déborah · Assistante IA · Beta
          </span>
          <h1 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface">
            Déborah te trouve l&apos;annonce parfaite,{" "}
            <span className="bg-gradient-to-r from-[#2f6fb8] to-[#7b3fd6] bg-clip-text text-transparent">
              en quelques questions
            </span>
          </h1>
          <p className="text-outline mt-2 text-sm md:text-base max-w-xl mx-auto">
            Réponds simplement aux questions de Déborah — catégorie, budget, ville — elle filtre les annonces et te sort celles qui collent.
          </p>
        </header>

        <AIChat />
      </main>

      <SiteFooter />
      <BottomNav />
    </div>
  );
}

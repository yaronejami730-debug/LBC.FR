import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";

const BASE = "https://www.dealandcompany.fr";

export const metadata: Metadata = {
  title: "Mentions légales — Deal&Co",
  description: "Mentions légales de Deal&Co, site de petites annonces gratuites entre particuliers en France.",
  alternates: { canonical: `${BASE}/mentions-legales` },
  robots: { index: true, follow: true },
};

export default function MentionsLegalesPage() {
  return (
    <div className="bg-surface text-on-surface mb-24 md:mb-0">
      <Navbar />
      <main className="pt-32 pb-16 px-6 max-w-3xl mx-auto">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-outline flex items-center gap-2">
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <span className="text-on-surface font-semibold">Mentions légales</span>
        </nav>

        <h1 className="text-3xl font-extrabold tracking-tight text-on-surface mb-8">Mentions légales</h1>

        <div className="space-y-8 text-on-surface-variant leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Éditeur du site</h2>
            <p>
              Le site <strong>Deal&amp;Co</strong> (dealandcompany.fr) est édité par une personne physique domiciliée en France.
            </p>
            <p className="mt-2">
              Directeur de la publication : disponible sur demande à <a href="mailto:contact@dealandcompany.fr" className="text-primary hover:underline">contact@dealandcompany.fr</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Hébergement</h2>
            <p>
              Le site est hébergé par <strong>Vercel Inc.</strong>, 340 Pine Street, Suite 701, San Francisco, CA 94104, États-Unis.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Propriété intellectuelle</h2>
            <p>
              L'ensemble du contenu de ce site (textes, images, graphismes, logo, icônes, etc.) est la propriété exclusive de Deal&amp;Co, sauf mentions contraires. Toute reproduction, distribution, modification, adaptation, retransmission ou publication de ces éléments est strictement interdite sans l'accord express et écrit de Deal&amp;Co.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Responsabilité</h2>
            <p>
              Deal&amp;Co est un intermédiaire technique permettant à des particuliers et professionnels de publier et consulter des annonces. Deal&amp;Co n'est pas partie aux transactions et ne peut être tenu responsable du contenu des annonces publiées par les utilisateurs, ni des transactions réalisées entre vendeurs et acheteurs.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Contact</h2>
            <p>
              Pour toute question : <a href="mailto:contact@dealandcompany.fr" className="text-primary hover:underline">contact@dealandcompany.fr</a>
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
      <BottomNav />
    </div>
  );
}

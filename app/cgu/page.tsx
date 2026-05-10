import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";

const BASE = "https://www.dealandcompany.fr";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation — Deal&Co",
  description: "Conditions générales d'utilisation de Deal&Co, site de petites annonces gratuites entre particuliers en France.",
  alternates: { canonical: `${BASE}/cgu` },
  robots: { index: true, follow: true },
};

export default function CGUPage() {
  return (
    <div className="bg-surface text-on-surface mb-24 md:mb-0">
      <Navbar />
      <main className="pt-32 pb-16 px-6 max-w-3xl mx-auto">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-outline flex items-center gap-2">
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <span className="text-on-surface font-semibold">CGU</span>
        </nav>

        <h1 className="text-3xl font-extrabold tracking-tight text-on-surface mb-8">Conditions Générales d'Utilisation</h1>

        <div className="space-y-8 text-on-surface-variant leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 1 — Objet</h2>
            <p>
              Les présentes conditions générales d'utilisation (CGU) régissent l'accès et l'utilisation du site Deal&amp;Co (dealandcompany.fr), plateforme de petites annonces gratuites entre particuliers et professionnels en France. En accédant au site, vous acceptez sans réserve les présentes CGU.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 2 — Accès au service</h2>
            <p>
              La consultation des annonces est libre et gratuite. La publication d'annonces requiert la création d'un compte utilisateur. L'accès au service est réservé aux personnes âgées d'au moins 18 ans ou aux mineurs avec l'accord de leurs représentants légaux.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 3 — Publication d'annonces</h2>
            <p>
              Toute annonce publiée doit respecter la législation française en vigueur et les règles de la plateforme. Sont notamment interdits : les annonces de produits contrefaits, les produits illicites, les contenus trompeurs ou frauduleux, et toute offre portant atteinte aux droits d'autrui.
            </p>
            <p className="mt-2">
              Deal&amp;Co se réserve le droit de modérer, modifier ou supprimer toute annonce ne respectant pas ces règles, sans préavis ni indemnité.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 4 — Responsabilité des utilisateurs</h2>
            <p>
              Chaque utilisateur est seul responsable du contenu qu'il publie. Deal&amp;Co agit en tant qu'hébergeur au sens de la loi pour la Confiance dans l'Économie Numérique (LCEN) et ne peut être tenu responsable du contenu publié par les utilisateurs.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 5 — Propriété intellectuelle</h2>
            <p>
              En publiant du contenu sur Deal&amp;Co, l'utilisateur accorde à la plateforme une licence non exclusive d'utilisation pour les besoins du service. L'utilisateur garantit être titulaire des droits sur le contenu publié.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 6 — Modifications des CGU</h2>
            <p>
              Deal&amp;Co se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés de toute modification substantielle. La poursuite de l'utilisation du service vaut acceptation des nouvelles CGU.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 7 — Droit applicable</h2>
            <p>
              Les présentes CGU sont soumises au droit français. Tout litige sera soumis aux juridictions compétentes françaises.
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

import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";

const BASE = "https://www.dealandcompany.fr";

export const metadata: Metadata = {
  title: "Mentions légales — Deal&Co",
  description:
    "Mentions légales de Deal&Co, plateforme de petites annonces entre particuliers et professionnels en France.",
  alternates: { canonical: `${BASE}/mentions-legales` },
  robots: { index: true, follow: true },
};

const LAST_UPDATE = "11 mai 2026";

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

        <h1 className="text-3xl font-extrabold tracking-tight text-on-surface mb-2">Mentions légales</h1>
        <p className="text-sm text-outline mb-10">Dernière mise à jour : {LAST_UPDATE}</p>

        <div className="space-y-10 text-on-surface-variant leading-relaxed">

          {/* Éditeur */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">1. Éditeur du site</h2>
            <p>
              Le site <strong>Deal&amp;Co</strong>, accessible à l'adresse{" "}
              <a href="https://www.dealandcompany.fr" className="text-primary hover:underline">
                www.dealandcompany.fr
              </a>
              , est édité par une personne physique domiciliée en France.
            </p>
            <p className="mt-3">
              <strong>Directeur de la publication :</strong> disponible sur demande à{" "}
              <a href="mailto:contact@dealandcompany.fr" className="text-primary hover:underline">
                contact@dealandcompany.fr
              </a>
            </p>
            <p className="mt-2">
              <strong>Contact général :</strong>{" "}
              <a href="mailto:contact@dealandcompany.fr" className="text-primary hover:underline">
                contact@dealandcompany.fr
              </a>
            </p>
          </section>

          {/* Hébergement */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">2. Hébergement technique</h2>
            <p className="mb-4">
              Deal&amp;Co s'appuie sur des prestataires techniques reconnus pour l'hébergement
              de sa plateforme et de ses données :
            </p>

            <div className="space-y-4">
              <div className="p-4 bg-surface-variant rounded-xl">
                <p className="font-semibold text-on-surface mb-1">Application web</p>
                <p>
                  <strong>Vercel Inc.</strong><br />
                  440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis<br />
                  <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    vercel.com
                  </a>
                </p>
                <p className="mt-2 text-sm">
                  Le déploiement et la livraison de l'application sont assurés par Vercel,
                  dont les infrastructures de diffusion (CDN) peuvent opérer depuis différentes régions mondiales,
                  y compris l'Union européenne.
                </p>
              </div>

              <div className="p-4 bg-surface-variant rounded-xl">
                <p className="font-semibold text-on-surface mb-1">Base de données et stockage</p>
                <p>
                  <strong>Supabase Inc.</strong><br />
                  970 Toa Payoh North, Singapour (société) — serveurs en <strong>Irlande (eu-west-1, Union européenne)</strong><br />
                  <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    supabase.com
                  </a>
                </p>
                <p className="mt-2 text-sm">
                  Les données personnelles des utilisateurs sont stockées sur des serveurs physiquement
                  situés en Irlande, au sein de l'Union européenne, conformément aux exigences du RGPD.
                </p>
              </div>
            </div>
          </section>

          {/* Propriété intellectuelle */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">3. Propriété intellectuelle</h2>
            <p>
              L'ensemble des éléments constituant le site Deal&amp;Co (textes, graphismes, logo, icônes,
              structure, code source, etc.) est la propriété exclusive de Deal&amp;Co, sauf mentions
              contraires expresses.
            </p>
            <p className="mt-3">
              Toute reproduction, représentation, modification, adaptation, traduction ou exploitation
              de tout ou partie du site, par quelque moyen et sur quelque support que ce soit, est strictement
              interdite sans l'accord préalable et écrit de Deal&amp;Co, sous peine de poursuites civiles et
              pénales pour contrefaçon.
            </p>
            <p className="mt-3">
              Les marques, logos et signes distinctifs reproduits sur le site sont la propriété de leurs
              titulaires respectifs.
            </p>
          </section>

          {/* Contenu utilisateur */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">4. Contenu publié par les utilisateurs</h2>
            <p>
              Deal&amp;Co est une plateforme d'intermédiation permettant à des particuliers et professionnels
              de publier des annonces. À ce titre, Deal&amp;Co agit en qualité d'hébergeur au sens de la loi
              pour la Confiance dans l'Économie Numérique (LCEN, loi n° 2004-575 du 21 juin 2004).
            </p>
            <p className="mt-3">
              Deal&amp;Co n'est pas l'auteur des contenus publiés par les utilisateurs et ne peut en être
              tenu responsable, sous réserve de sa connaissance effective d'un contenu manifestement illicite
              et de son retrait dans un délai raisonnable suite à une notification valide.
            </p>
            <p className="mt-3">
              Pour signaler un contenu illicite :{" "}
              <a href="mailto:contact@dealandcompany.fr" className="text-primary hover:underline">
                contact@dealandcompany.fr
              </a>
            </p>
          </section>

          {/* Responsabilité */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">5. Limitation de responsabilité</h2>
            <p>
              Deal&amp;Co s'efforce d'assurer l'exactitude et la mise à jour des informations diffusées
              sur son site. Toutefois, Deal&amp;Co ne peut garantir l'exhaustivité, la précision ou
              l'actualité des informations publiées par les utilisateurs.
            </p>
            <p className="mt-3">
              Deal&amp;Co ne saurait être tenu responsable des dommages directs ou indirects résultant
              de l'utilisation du site, d'une interruption du service, d'une intrusion extérieure ou
              de la présence de virus informatiques.
            </p>
            <p className="mt-3">
              Deal&amp;Co n'est pas partie aux transactions conclues entre utilisateurs et n'en assume
              aucune responsabilité. Chaque utilisateur traite à ses propres risques.
            </p>
          </section>

          {/* Liens hypertextes */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">6. Liens hypertextes</h2>
            <p>
              Le site peut contenir des liens vers des sites tiers. Deal&amp;Co n'exerce aucun contrôle
              sur ces sites et décline toute responsabilité quant à leur contenu ou leurs pratiques.
              La mise en place de liens vers dealandcompany.fr est autorisée sous réserve qu'elle ne
              porte pas atteinte à l'image ou à l'intégrité de la plateforme.
            </p>
          </section>

          {/* Droit applicable */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">7. Droit applicable et juridiction compétente</h2>
            <p>
              Les présentes mentions légales sont régies par le droit français. En cas de litige,
              les tribunaux français seront seuls compétents, sauf disposition légale impérative contraire.
            </p>
          </section>

          {/* Données personnelles */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">8. Données personnelles et cookies</h2>
            <p>
              Le traitement des données personnelles collectées sur ce site est décrit en détail dans
              notre{" "}
              <Link href="/confidentialite" className="text-primary hover:underline">
                Politique de confidentialité
              </Link>
              , conformément au RGPD et à la loi Informatique et Libertés.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">9. Contact</h2>
            <p>
              Pour toute question relative au site, à son contenu ou à son fonctionnement :{" "}
              <a href="mailto:contact@dealandcompany.fr" className="text-primary hover:underline">
                contact@dealandcompany.fr
              </a>
            </p>
          </section>

        </div>
      </main>
      <SiteFooter />
      <BottomNav />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";

const BASE = "https://www.dealandcompany.fr";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Deal&Co",
  description: "Politique de confidentialité et protection des données personnelles de Deal&Co, conformément au RGPD.",
  alternates: { canonical: `${BASE}/confidentialite` },
  robots: { index: true, follow: true },
};

export default function ConfidentialitePage() {
  return (
    <div className="bg-surface text-on-surface mb-24 md:mb-0">
      <Navbar />
      <main className="pt-32 pb-16 px-6 max-w-3xl mx-auto">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-outline flex items-center gap-2">
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <span className="text-on-surface font-semibold">Politique de confidentialité</span>
        </nav>

        <h1 className="text-3xl font-extrabold tracking-tight text-on-surface mb-8">Politique de confidentialité</h1>

        <div className="space-y-8 text-on-surface-variant leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">1. Responsable du traitement</h2>
            <p>
              Deal&amp;Co (dealandcompany.fr) est responsable du traitement de vos données personnelles conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés.
            </p>
            <p className="mt-2">Contact DPO : <a href="mailto:contact@dealandcompany.fr" className="text-primary hover:underline">contact@dealandcompany.fr</a></p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">2. Données collectées</h2>
            <p>Nous collectons les données suivantes :</p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>Données d'identification : nom, adresse e-mail, numéro de téléphone (facultatif)</li>
              <li>Données de profil : photo de profil, description, SIRET (pour les professionnels)</li>
              <li>Données d'annonces : titre, description, photos, prix, localisation</li>
              <li>Données de navigation : adresse IP, cookies, pages visitées</li>
              <li>Données de messagerie : échanges entre utilisateurs via la messagerie interne</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">3. Finalités du traitement</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Gestion des comptes utilisateurs et authentification</li>
              <li>Publication et modération des annonces</li>
              <li>Mise en relation entre acheteurs et vendeurs</li>
              <li>Envoi de notifications et d'alertes (annonces sauvegardées)</li>
              <li>Amélioration du service et analyses statistiques</li>
              <li>Respect des obligations légales</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">4. Base légale</h2>
            <p>
              Le traitement de vos données est fondé sur : l'exécution du contrat (utilisation du service), votre consentement (newsletters, cookies analytiques), et nos obligations légales.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">5. Durée de conservation</h2>
            <p>
              Vos données sont conservées pendant la durée d'activité de votre compte, puis supprimées dans un délai de 3 ans après la dernière connexion, sauf obligation légale contraire.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">6. Partage des données</h2>
            <p>
              Vos données ne sont pas vendues à des tiers. Elles peuvent être partagées avec nos prestataires techniques (hébergement, paiement) dans le strict cadre de l'exécution du service, sous contrat garantissant leur protection.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">7. Vos droits</h2>
            <p>Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>Droit d'accès à vos données</li>
              <li>Droit de rectification</li>
              <li>Droit à l'effacement (« droit à l'oubli »)</li>
              <li>Droit à la portabilité</li>
              <li>Droit d'opposition au traitement</li>
              <li>Droit à la limitation du traitement</li>
            </ul>
            <p className="mt-3">
              Pour exercer ces droits : <a href="mailto:contact@dealandcompany.fr" className="text-primary hover:underline">contact@dealandcompany.fr</a>. Vous pouvez également introduire une réclamation auprès de la <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">CNIL</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">8. Cookies</h2>
            <p>
              Deal&amp;Co utilise des cookies strictement nécessaires au fonctionnement du service (session, authentification). Aucun cookie publicitaire tiers n'est utilisé sans votre consentement.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
      <BottomNav />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";

const BASE = "https://www.dealandcompany.fr";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Deal&Co",
  description:
    "Politique de confidentialité et protection des données personnelles de Deal&Co, conformément au RGPD (Règlement Général sur la Protection des Données).",
  alternates: { canonical: `${BASE}/confidentialite` },
  robots: { index: true, follow: true },
};

const LAST_UPDATE = "11 mai 2026";

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

        <h1 className="text-3xl font-extrabold tracking-tight text-on-surface mb-2">
          Politique de confidentialité
        </h1>
        <p className="text-sm text-outline mb-10">Dernière mise à jour : {LAST_UPDATE}</p>

        <div className="space-y-10 text-on-surface-variant leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">1. Responsable du traitement</h2>
            <p>
              La plateforme <strong>Deal&amp;Co</strong>, accessible à l'adresse{" "}
              <a href="https://www.dealandcompany.fr" className="text-primary hover:underline">dealandcompany.fr</a>,
              est éditée par une personne physique domiciliée en France, ci-après dénommée « Deal&amp;Co » ou « nous ».
            </p>
            <p className="mt-3">
              En tant que responsable du traitement, Deal&amp;Co s'engage à traiter vos données personnelles
              conformément au Règlement Général sur la Protection des Données (RGPD — UE 2016/679),
              à la loi Informatique et Libertés (loi n° 78-17 du 6 janvier 1978, modifiée)
              et à toute réglementation applicable en matière de protection des données.
            </p>
            <p className="mt-3">
              <strong>Contact :</strong>{" "}
              <a href="mailto:contact@dealandcompany.fr" className="text-primary hover:underline">
                contact@dealandcompany.fr
              </a>
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">2. Données personnelles collectées</h2>
            <p className="mb-3">Nous collectons les catégories de données suivantes, selon votre utilisation du service :</p>

            <h3 className="font-semibold text-on-surface mb-2">2.1 Données d'identification et de compte</h3>
            <ul className="list-disc list-inside space-y-1 mb-4">
              <li>Nom et prénom (ou pseudonyme)</li>
              <li>Adresse e-mail</li>
              <li>Mot de passe (stocké sous forme hachée, non lisible)</li>
              <li>Numéro de téléphone (facultatif, renseigné par l'utilisateur)</li>
              <li>Photo de profil (facultative)</li>
              <li>Numéro SIRET et raison sociale (pour les comptes professionnels)</li>
              <li>Date de création du compte et date de dernière connexion</li>
            </ul>

            <h3 className="font-semibold text-on-surface mb-2">2.2 Données liées aux annonces</h3>
            <ul className="list-disc list-inside space-y-1 mb-4">
              <li>Titre, description, prix, catégorie et localisation de l'annonce</li>
              <li>Photographies publiées avec l'annonce</li>
              <li>Historique des annonces publiées, modifiées ou supprimées</li>
            </ul>

            <h3 className="font-semibold text-on-surface mb-2">2.3 Données de communication</h3>
            <ul className="list-disc list-inside space-y-1 mb-4">
              <li>Messages échangés via la messagerie interne entre utilisateurs</li>
              <li>Alertes et recherches sauvegardées</li>
              <li>Annonces mises en favoris</li>
            </ul>

            <h3 className="font-semibold text-on-surface mb-2">2.4 Données techniques et de navigation</h3>
            <ul className="list-disc list-inside space-y-1 mb-4">
              <li>Adresse IP</li>
              <li>Type de navigateur et appareil</li>
              <li>Pages visitées et durée de session</li>
              <li>Données de journalisation (logs) à des fins de sécurité</li>
            </ul>

            <h3 className="font-semibold text-on-surface mb-2">2.5 Données de localisation</h3>
            <p>
              Lorsque vous publiez une annonce, vous renseignez une localisation (ville ou code postal).
              Deal&amp;Co ne collecte pas votre position GPS précise sans votre consentement explicite.
              Toute fonctionnalité de géolocalisation plus précise fera l'objet d'une demande de permission
              distincte, avec possibilité de refus sans impact sur l'accès au service principal.
            </p>

            <h3 className="font-semibold text-on-surface mb-2 mt-4">2.6 Notifications</h3>
            <p>
              Si vous activez les notifications (alertes, messages), nous collectons les identifiants
              techniques nécessaires à leur acheminement. Vous pouvez retirer ce consentement à tout
              moment depuis les paramètres de votre appareil ou de votre compte.
            </p>

            <h3 className="font-semibold text-on-surface mb-2 mt-4">2.7 Données de paiement (future fonctionnalité)</h3>
            <p>
              Deal&amp;Co prévoit d'intégrer des fonctionnalités de paiement sécurisé. Le cas échéant,
              les données bancaires ne seront jamais stockées directement sur nos serveurs : elles seront
              traitées exclusivement par un prestataire de paiement certifié PCI-DSS. Cette politique sera
              mise à jour avant le déploiement de cette fonctionnalité.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">3. Finalités et bases légales du traitement</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-surface-variant text-on-surface">
                    <th className="text-left p-3 border border-outline/20 font-semibold">Finalité</th>
                    <th className="text-left p-3 border border-outline/20 font-semibold">Base légale (RGPD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline/10">
                  <tr>
                    <td className="p-3 border border-outline/20">Création et gestion du compte utilisateur</td>
                    <td className="p-3 border border-outline/20">Exécution du contrat (art. 6.1.b)</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-outline/20">Authentification et sécurité</td>
                    <td className="p-3 border border-outline/20">Exécution du contrat · Intérêt légitime (art. 6.1.b et 6.1.f)</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-outline/20">Publication et modération des annonces</td>
                    <td className="p-3 border border-outline/20">Exécution du contrat (art. 6.1.b)</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-outline/20">Messagerie interne entre utilisateurs</td>
                    <td className="p-3 border border-outline/20">Exécution du contrat (art. 6.1.b)</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-outline/20">Envoi d'alertes et notifications</td>
                    <td className="p-3 border border-outline/20">Consentement (art. 6.1.a)</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-outline/20">Amélioration du service et statistiques anonymisées</td>
                    <td className="p-3 border border-outline/20">Intérêt légitime (art. 6.1.f)</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-outline/20">Prévention de la fraude et des abus</td>
                    <td className="p-3 border border-outline/20">Intérêt légitime (art. 6.1.f)</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-outline/20">Respect des obligations légales</td>
                    <td className="p-3 border border-outline/20">Obligation légale (art. 6.1.c)</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-outline/20">Traitement des paiements (future fonctionnalité)</td>
                    <td className="p-3 border border-outline/20">Exécution du contrat (art. 6.1.b)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">4. Durée de conservation</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>Données de compte actif :</strong> conservées pendant toute la durée d'activité du compte.
              </li>
              <li>
                <strong>Après suppression du compte :</strong> les données sont supprimées sous 30 jours,
                à l'exception des données nécessaires au respect d'obligations légales (ex. : journaux de connexion
                conservés 12 mois conformément à la législation française).
              </li>
              <li>
                <strong>Annonces expirées ou supprimées :</strong> conservées 12 mois à des fins de traçabilité
                et de lutte contre les abus, puis définitivement supprimées.
              </li>
              <li>
                <strong>Messages :</strong> conservés pendant la durée de la relation entre les utilisateurs,
                puis supprimés 12 mois après la clôture de la conversation.
              </li>
              <li>
                <strong>Données de navigation (logs) :</strong> conservées 12 mois maximum.
              </li>
              <li>
                <strong>Compte inactif :</strong> en l'absence de toute connexion pendant 3 ans,
                le compte peut être archivé après information préalable de l'utilisateur.
              </li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">5. Hébergement et transfert des données</h2>

            <h3 className="font-semibold text-on-surface mb-2">5.1 Infrastructure</h3>
            <p className="mb-3">
              Deal&amp;Co privilégie des infrastructures hébergées dans l'Union européenne afin d'assurer
              un niveau élevé de protection des données personnelles.
            </p>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li>
                <strong>Base de données et stockage :</strong> hébergés par{" "}
                <strong>Supabase</strong> (Supabase Inc., États-Unis) sur des serveurs physiquement
                situés en <strong>Irlande (région eu-west-1, Union européenne)</strong>. Vos données
                personnelles sont donc stockées au sein de l'UE.
              </li>
              <li>
                <strong>Application web (frontend) :</strong> déployée via <strong>Vercel</strong>{" "}
                (Vercel Inc., États-Unis), dont les serveurs de rendu et de livraison de contenu peuvent
                opérer depuis différentes régions, y compris au sein de l'Union européenne.
              </li>
            </ul>

            <h3 className="font-semibold text-on-surface mb-2">5.2 Transferts hors UE</h3>
            <p>
              Les sociétés Supabase et Vercel sont établies aux États-Unis. En tant que sous-traitants,
              elles peuvent traiter certaines données d'administration et de support depuis des pays tiers.
              Ces transferts sont encadrés par des garanties appropriées, notamment les Clauses Contractuelles
              Types (CCT) adoptées par la Commission européenne, conformément à l'article 46 du RGPD.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">6. Partage des données avec des tiers</h2>
            <p className="mb-3">
              Vos données personnelles ne sont ni vendues, ni louées, ni cédées à des tiers à des fins commerciales.
              Elles peuvent être communiquées dans les cas suivants :
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>Sous-traitants techniques :</strong> Vercel et Supabase, dans le strict cadre
                de l'exécution du service et liés par des contrats de traitement conformes au RGPD.
              </li>
              <li>
                <strong>Autres utilisateurs :</strong> les informations que vous rendez publiques
                (nom/pseudonyme, annonces, ville) sont visibles par les autres utilisateurs de la plateforme.
              </li>
              <li>
                <strong>Obligations légales :</strong> sur réquisition judiciaire ou administrative
                dûment motivée, ou pour prévenir une atteinte grave aux droits d'une personne.
              </li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">7. Sécurité des données</h2>
            <p className="mb-3">
              Deal&amp;Co met en œuvre des mesures techniques et organisationnelles appropriées pour
              protéger vos données contre tout accès non autorisé, perte, altération ou divulgation :
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Chiffrement des communications via HTTPS (TLS)</li>
              <li>Mots de passe stockés sous forme hachée (algorithme bcrypt)</li>
              <li>Vérification de l'adresse e-mail lors de la création du compte</li>
              <li>Accès aux données restreint au personnel habilité</li>
              <li>Journalisation des accès à des fins de détection d'anomalies</li>
              <li>Infrastructure hébergée sur des plateformes certifiées (ISO 27001, SOC 2)</li>
            </ul>
            <p className="mt-3">
              Malgré ces mesures, aucun système n'est infaillible. En cas de violation de données
              susceptible d'engendrer un risque pour vos droits et libertés, vous serez notifié
              conformément à l'article 34 du RGPD.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">8. Cookies et traceurs</h2>
            <p className="mb-3">
              Deal&amp;Co utilise plusieurs catégories de cookies. Lors de votre première visite,
              un bandeau vous permet d&apos;accepter ou de refuser ceux qui nécessitent votre consentement.
              Votre choix est conservé 13 mois.
            </p>
            <ul className="list-disc list-inside space-y-2 mb-4">
              <li>
                <strong>Cookies essentiels (sans consentement) :</strong> maintien de votre session,
                authentification, sécurité (CSRF), mémorisation de vos préférences d&apos;affichage et
                de votre choix de consentement (<code>consent_v1</code>).
              </li>
              <li>
                <strong>Cookies de mesure d&apos;audience (Google Analytics 4) :</strong> nous aident
                à comprendre comment le site est utilisé (pages visitées, durée, parcours).
                Identifiant utilisé : <code>G-31WRQ5YXX6</code>. Données traitées par Google Ireland
                Ltd, transferts encadrés par le DPF UE-États-Unis.
              </li>
              <li>
                <strong>Cookies publicitaires (Google AdSense) :</strong> permettent à Google
                d&apos;afficher des annonces personnalisées et de mesurer leur performance.
                Éditeur : <code>ca-pub-1774647148412256</code>. Données traitées par Google Ireland Ltd.
              </li>
            </ul>
            <p className="mb-3">
              Nous utilisons le <strong>Consent Mode v2</strong> de Google : tant que vous n&apos;avez
              pas explicitement consenti, aucun cookie publicitaire ni d&apos;analyse n&apos;est posé,
              et les requêtes vers Google sont anonymisées (« cookieless pings »).
            </p>
            <p className="mb-3">
              Vous pouvez à tout moment modifier votre choix en supprimant le cookie
              <code> consent_v1</code> depuis votre navigateur, ou en utilisant le lien
              « Gérer mes cookies » que nous afficherons en pied de page.
            </p>
            <p>
              Pour exercer vos droits ou paramétrer la publicité personnalisée Google directement
              chez l&apos;éditeur, consultez :{" "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                policies.google.com/privacy
              </a>{" "}
              et{" "}
              <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                adssettings.google.com
              </a>.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">9. Vos droits RGPD</h2>
            <p className="mb-3">
              Conformément au RGPD, vous disposez des droits suivants concernant vos données personnelles :
            </p>
            <ul className="space-y-3">
              <li>
                <strong>Droit d'accès (art. 15) :</strong> obtenir la confirmation que vos données sont traitées
                et en recevoir une copie.
              </li>
              <li>
                <strong>Droit de rectification (art. 16) :</strong> corriger des données inexactes ou incomplètes.
              </li>
              <li>
                <strong>Droit à l'effacement (art. 17) :</strong> demander la suppression de vos données
                (« droit à l'oubli »), sous réserve de nos obligations légales de conservation.
              </li>
              <li>
                <strong>Droit à la portabilité (art. 20) :</strong> recevoir vos données dans un format
                structuré et lisible par machine, afin de les transférer vers un autre service.
              </li>
              <li>
                <strong>Droit d'opposition (art. 21) :</strong> vous opposer au traitement fondé sur
                notre intérêt légitime.
              </li>
              <li>
                <strong>Droit à la limitation (art. 18) :</strong> demander la suspension temporaire
                du traitement dans les cas prévus par le RGPD.
              </li>
              <li>
                <strong>Droit de retirer votre consentement :</strong> à tout moment, pour les traitements
                fondés sur votre consentement (notifications, etc.), sans que cela affecte la licéité
                des traitements antérieurs.
              </li>
            </ul>

            <div className="mt-5 p-4 bg-surface-variant rounded-xl">
              <p className="font-semibold text-on-surface mb-1">Exercer vos droits</p>
              <p>
                Adressez votre demande à{" "}
                <a href="mailto:contact@dealandcompany.fr" className="text-primary hover:underline">
                  contact@dealandcompany.fr
                </a>
                , en précisant votre identité. Nous nous engageons à répondre dans un délai d'un mois
                (article 12 du RGPD).
              </p>
              <p className="mt-2">
                Vous pouvez également introduire une réclamation auprès de la{" "}
                <a
                  href="https://www.cnil.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  CNIL
                </a>{" "}
                (Commission Nationale de l'Informatique et des Libertés), autorité de contrôle française.
              </p>
            </div>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">10. Suppression de compte</h2>
            <p className="mb-3">
              Vous pouvez demander la suppression de votre compte et de vos données personnelles à tout moment :
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                Depuis votre espace personnel (section « Paramètres du compte »).
              </li>
              <li>
                Par e-mail à{" "}
                <a href="mailto:contact@dealandcompany.fr" className="text-primary hover:underline">
                  contact@dealandcompany.fr
                </a>{" "}
                avec l'objet « Suppression de mon compte ».
              </li>
            </ul>
            <p className="mt-3">
              Suite à votre demande, vos données sont supprimées dans un délai de 30 jours.
              Certaines données peuvent être conservées au-delà de ce délai si la loi nous y oblige
              (obligations comptables, prévention de la fraude, réquisitions judiciaires).
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">11. Mineurs</h2>
            <p>
              Deal&amp;Co est un service destiné aux personnes âgées d'au moins 18 ans.
              Nous ne collectons pas sciemment de données personnelles relatives à des mineurs.
              Si vous constatez qu'un mineur a créé un compte, contactez-nous à{" "}
              <a href="mailto:contact@dealandcompany.fr" className="text-primary hover:underline">
                contact@dealandcompany.fr
              </a>{" "}
              pour que nous puissions supprimer les données concernées.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">12. Mise à jour de cette politique</h2>
            <p>
              Cette politique de confidentialité peut être mise à jour afin de refléter l'évolution
              de nos pratiques ou des exigences réglementaires. En cas de modification substantielle,
              vous serez informé par e-mail ou par une notification visible sur le site.
              La date de dernière mise à jour est indiquée en haut de cette page.
            </p>
          </section>

        </div>
      </main>
      <SiteFooter />
      <BottomNav />
    </div>
  );
}

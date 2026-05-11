import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";

const BASE = "https://www.dealandcompany.fr";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation — Deal&Co",
  description:
    "Conditions générales d'utilisation de Deal&Co, plateforme de petites annonces entre particuliers et professionnels en France.",
  alternates: { canonical: `${BASE}/cgu` },
  robots: { index: true, follow: true },
};

const LAST_UPDATE = "11 mai 2026";

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

        <h1 className="text-3xl font-extrabold tracking-tight text-on-surface mb-2">
          Conditions Générales d'Utilisation
        </h1>
        <p className="text-sm text-outline mb-10">Dernière mise à jour : {LAST_UPDATE}</p>

        <div className="space-y-10 text-on-surface-variant leading-relaxed">

          {/* Art 1 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 1 — Objet et champ d'application</h2>
            <p>
              Les présentes Conditions Générales d'Utilisation (ci-après « CGU ») régissent l'accès
              et l'utilisation de la plateforme <strong>Deal&amp;Co</strong>, accessible à l'adresse{" "}
              <a href="https://www.dealandcompany.fr" className="text-primary hover:underline">
                dealandcompany.fr
              </a>
              , service de petites annonces permettant la mise en relation entre particuliers et
              professionnels en France.
            </p>
            <p className="mt-3">
              En accédant à la plateforme et en créant un compte, vous reconnaissez avoir lu, compris
              et accepté sans réserve les présentes CGU dans leur intégralité. Si vous n'acceptez pas
              ces conditions, vous êtes invité à ne pas utiliser le service.
            </p>
          </section>

          {/* Art 2 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 2 — Description du service</h2>
            <p>
              Deal&amp;Co est une plateforme d'intermédiation permettant à ses utilisateurs de :
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 mb-3">
              <li>Consulter librement des annonces publiées par d'autres utilisateurs</li>
              <li>Créer un compte et publier des annonces de vente, d'achat ou de service</li>
              <li>Contacter d'autres utilisateurs via la messagerie interne sécurisée</li>
              <li>Sauvegarder des recherches et recevoir des alertes personnalisées</li>
              <li>Accéder à des fonctionnalités réservées aux comptes professionnels</li>
            </ul>
            <p>
              Deal&amp;Co agit exclusivement en qualité d'hébergeur et d'intermédiaire technique.
              La plateforme n'est partie à aucune transaction entre utilisateurs et n'en assume aucune
              responsabilité.
            </p>
          </section>

          {/* Art 3 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 3 — Accès au service et création de compte</h2>

            <h3 className="font-semibold text-on-surface mb-2">3.1 Conditions d'accès</h3>
            <p>
              La consultation des annonces est libre et ne requiert pas de création de compte.
              La publication d'annonces, l'utilisation de la messagerie et l'accès aux fonctionnalités
              personnalisées nécessitent la création d'un compte utilisateur.
            </p>
            <p className="mt-3">
              L'accès au service est réservé aux personnes physiques majeures (18 ans et plus)
              ou aux personnes morales dûment représentées. Les mineurs peuvent utiliser le service
              avec l'accord exprès de leur représentant légal, qui en assume la pleine responsabilité.
            </p>

            <h3 className="font-semibold text-on-surface mb-2 mt-4">3.2 Création et sécurité du compte</h3>
            <p>
              Lors de la création de votre compte, vous vous engagez à fournir des informations exactes,
              complètes et à jour. Vous êtes seul responsable de la confidentialité de vos identifiants
              de connexion et de toute activité effectuée depuis votre compte.
            </p>
            <p className="mt-3">
              La création de comptes multiples par une même personne, ainsi que l'utilisation de fausses
              identités, est strictement interdite et peut entraîner la suspension immédiate du ou des
              comptes concernés.
            </p>

            <h3 className="font-semibold text-on-surface mb-2 mt-4">3.3 Vérification de l'adresse e-mail</h3>
            <p>
              Après création de votre compte, une vérification de votre adresse e-mail est requise
              avant toute publication d'annonce. Cette étape contribue à la sécurité et à la qualité
              de la plateforme.
            </p>
          </section>

          {/* Art 4 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 4 — Publication d'annonces</h2>

            <h3 className="font-semibold text-on-surface mb-2">4.1 Règles générales</h3>
            <p>
              Toute annonce publiée sur Deal&amp;Co doit respecter la législation française et européenne
              en vigueur, ainsi que les présentes CGU. En publiant une annonce, vous certifiez :
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 mb-3">
              <li>Être propriétaire du bien ou habilité à le vendre / proposer le service</li>
              <li>Que les informations fournies sont exactes et sincères</li>
              <li>Que le contenu (textes, photos) ne porte pas atteinte aux droits de tiers</li>
            </ul>

            <h3 className="font-semibold text-on-surface mb-2 mt-4">4.2 Contenus interdits</h3>
            <p>Sont expressément interdits sur Deal&amp;Co :</p>
            <ul className="list-disc list-inside space-y-1 mt-2 mb-3">
              <li>Les produits illicites, contrefaits ou dont la vente est réglementée sans autorisation</li>
              <li>Les armes, munitions et produits stupéfiants</li>
              <li>Les contenus à caractère pornographique, diffamatoire, haineux ou discriminatoire</li>
              <li>Les offres trompeuses, frauduleuses ou constituant une escroquerie</li>
              <li>La publication de données personnelles de tiers sans leur consentement</li>
              <li>Tout contenu violant les droits de propriété intellectuelle d'un tiers</li>
              <li>Les annonces de prostitution ou de services sexuels tarifés</li>
            </ul>

            <h3 className="font-semibold text-on-surface mb-2 mt-4">4.3 Modération</h3>
            <p>
              Deal&amp;Co se réserve le droit de modérer, modifier, masquer ou supprimer toute annonce
              qui ne respecterait pas les présentes CGU ou la législation applicable, sans préavis
              ni indemnité. Un système de modération automatique et manuelle est en place pour garantir
              la qualité et la sécurité des annonces publiées.
            </p>

            <h3 className="font-semibold text-on-surface mb-2 mt-4">4.4 Durée de validité des annonces</h3>
            <p>
              Les annonces sont publiées pour une durée déterminée, précisée sur la plateforme.
              À l'expiration de cette durée, l'annonce n'est plus visible publiquement mais peut
              être republiée par l'utilisateur depuis son espace personnel.
            </p>
          </section>

          {/* Art 5 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 5 — Comptes professionnels</h2>
            <p>
              Les utilisateurs exerçant une activité commerciale à titre habituel sont tenus de créer
              un compte professionnel et de renseigner leur numéro SIRET. La publication d'annonces
              à caractère professionnel depuis un compte particulier est contraire aux CGU et peut
              entraîner la suspension du compte.
            </p>
            <p className="mt-3">
              Les comptes professionnels bénéficient de fonctionnalités dédiées et sont soumis
              à des obligations spécifiques en matière d'information des consommateurs,
              conformément à la réglementation applicable (notamment l'article L111-1 du Code de la
              consommation).
            </p>
          </section>

          {/* Art 6 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 6 — Messagerie et mise en relation</h2>
            <p>
              Deal&amp;Co met à disposition une messagerie interne sécurisée permettant aux utilisateurs
              d'entrer en contact. Cette messagerie est destinée exclusivement à des échanges relatifs
              aux annonces publiées sur la plateforme.
            </p>
            <p className="mt-3">
              Sont interdits via la messagerie : le spam, le harcèlement, les tentatives de fraude,
              la sollicitation à effectuer des transactions en dehors de la plateforme dans le but
              d'éviter les garanties offertes, et tout contenu illicite.
            </p>
            <p className="mt-3">
              Deal&amp;Co se réserve le droit d'analyser les contenus signalés à des fins de modération
              et de sécurité, dans le respect de la réglementation applicable.
            </p>
          </section>

          {/* Art 7 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 7 — Responsabilité des utilisateurs</h2>
            <p>
              Chaque utilisateur est seul responsable des contenus qu'il publie et des transactions
              qu'il conclut via la plateforme. Deal&amp;Co ne garantit pas l'identité des utilisateurs,
              la qualité des biens ou services proposés, ni la bonne exécution des transactions.
            </p>
            <p className="mt-3">
              L'utilisateur s'engage à indemniser Deal&amp;Co de toute réclamation, perte ou dommage
              résultant de son manquement aux présentes CGU ou de sa violation de toute loi ou
              réglementation applicable.
            </p>
          </section>

          {/* Art 8 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 8 — Propriété intellectuelle</h2>
            <p>
              En publiant du contenu sur Deal&amp;Co (textes, photos, descriptions), vous concédez
              à Deal&amp;Co une licence non exclusive, mondiale et gratuite d'utilisation, de reproduction
              et d'affichage de ce contenu dans le cadre du fonctionnement du service et de sa promotion.
            </p>
            <p className="mt-3">
              Vous garantissez disposer de tous les droits nécessaires sur les contenus publiés et
              que ces contenus ne portent pas atteinte aux droits de tiers. Cette licence prend fin
              lors de la suppression du contenu ou du compte.
            </p>
          </section>

          {/* Art 9 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 9 — Suspension et résiliation de compte</h2>
            <p>
              Deal&amp;Co se réserve le droit de suspendre ou de résilier un compte, avec ou sans
              préavis, en cas de :
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 mb-3">
              <li>Violation des présentes CGU</li>
              <li>Publication de contenus illicites ou frauduleux</li>
              <li>Comportement abusif envers d'autres utilisateurs</li>
              <li>Activité susceptible de porter atteinte à l'intégrité ou à la réputation de la plateforme</li>
              <li>Non-respect des obligations légales applicables</li>
            </ul>
            <p>
              L'utilisateur peut supprimer son compte à tout moment depuis son espace personnel
              ou en contactant{" "}
              <a href="mailto:contact@dealandcompany.fr" className="text-primary hover:underline">
                contact@dealandcompany.fr
              </a>
              . Les données personnelles sont alors supprimées conformément à notre{" "}
              <Link href="/confidentialite" className="text-primary hover:underline">
                Politique de confidentialité
              </Link>
              .
            </p>
          </section>

          {/* Art 10 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 10 — Disponibilité du service</h2>
            <p>
              Deal&amp;Co s'efforce d'assurer la disponibilité du service 24h/24 et 7j/7.
              Toutefois, des interruptions pour maintenance, mises à jour ou incidents techniques
              peuvent survenir. Deal&amp;Co décline toute responsabilité en cas d'interruption
              temporaire du service.
            </p>
          </section>

          {/* Art 11 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 11 — Paiements (fonctionnalité à venir)</h2>
            <p>
              Deal&amp;Co prévoit d'intégrer des fonctionnalités de paiement sécurisé entre utilisateurs.
              Lorsque ces fonctionnalités seront disponibles, des Conditions Générales de Vente (CGV)
              spécifiques seront publiées et s'appliqueront à ces transactions. Les présentes CGU seront
              mises à jour en conséquence.
            </p>
          </section>

          {/* Art 12 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 12 — Signalement d'abus</h2>
            <p>
              Tout utilisateur peut signaler une annonce ou un comportement inapproprié directement
              depuis la plateforme ou en contactant :{" "}
              <a href="mailto:contact@dealandcompany.fr" className="text-primary hover:underline">
                contact@dealandcompany.fr
              </a>
            </p>
            <p className="mt-3">
              Deal&amp;Co traite les signalements dans les meilleurs délais et prend les mesures
              appropriées conformément à la législation applicable.
            </p>
          </section>

          {/* Art 13 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 13 — Modification des CGU</h2>
            <p>
              Deal&amp;Co se réserve le droit de modifier les présentes CGU à tout moment pour refléter
              l'évolution du service ou de la réglementation applicable. Les utilisateurs seront informés
              de toute modification substantielle par e-mail ou par une notification sur la plateforme,
              avec un préavis raisonnable.
            </p>
            <p className="mt-3">
              La poursuite de l'utilisation du service après modification des CGU vaut acceptation
              des nouvelles conditions. En cas de désaccord, l'utilisateur peut supprimer son compte
              à tout moment.
            </p>
          </section>

          {/* Art 14 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 14 — Médiation et règlement des litiges</h2>
            <p>
              En cas de litige entre un utilisateur et Deal&amp;Co, les parties s'engagent à rechercher
              une solution amiable avant tout recours judiciaire. L'utilisateur peut contacter
              Deal&amp;Co à{" "}
              <a href="mailto:contact@dealandcompany.fr" className="text-primary hover:underline">
                contact@dealandcompany.fr
              </a>
              .
            </p>
            <p className="mt-3">
              Conformément au Code de la consommation (articles L616-1 et R616-1), les consommateurs
              peuvent recourir gratuitement à un médiateur de la consommation en vue de la résolution
              amiable d'un litige. La Commission européenne met également à disposition une plateforme
              de règlement en ligne des litiges :{" "}
              <a
                href="https://ec.europa.eu/consumers/odr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                ec.europa.eu/consumers/odr
              </a>
              .
            </p>
          </section>

          {/* Art 15 */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Article 15 — Droit applicable et juridiction</h2>
            <p>
              Les présentes CGU sont régies par le droit français. Tout litige relatif à leur
              interprétation ou à leur exécution sera soumis à la compétence exclusive des tribunaux
              français, sauf disposition légale impérative contraire applicable aux consommateurs.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-bold text-on-surface mb-3">Contact</h2>
            <p>
              Pour toute question relative aux présentes CGU :{" "}
              <a href="mailto:contact@dealandcompany.fr" className="text-primary hover:underline">
                contact@dealandcompany.fr
              </a>
            </p>
            <p className="mt-3">
              Consultez également notre{" "}
              <Link href="/confidentialite" className="text-primary hover:underline">
                Politique de confidentialité
              </Link>{" "}
              et nos{" "}
              <Link href="/mentions-legales" className="text-primary hover:underline">
                Mentions légales
              </Link>
              .
            </p>
          </section>

        </div>
      </main>
      <SiteFooter />
      <BottomNav />
    </div>
  );
}

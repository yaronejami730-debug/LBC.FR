"use client";

import { useState } from "react";
import Link from "next/link";

type Step = "cgu" | "confidentialite";

interface ConsentModalProps {
  onAccept: (marketingConsent: boolean) => void;
  onClose: () => void;
}

const CGU_TEXT = `
CONDITIONS GÉNÉRALES D'UTILISATION — Deal & Co
Dernière mise à jour : 11 mai 2026

Article 1 — Objet et champ d'application
Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme Deal & Co, accessible à l'adresse dealandcompany.fr, service de petites annonces permettant la mise en relation entre particuliers et professionnels en France.

En accédant à la plateforme et en créant un compte, vous reconnaissez avoir lu, compris et accepté sans réserve les présentes CGU dans leur intégralité.

Article 2 — Description du service
Deal & Co est une plateforme d'intermédiation permettant à ses utilisateurs de :
• Consulter librement des annonces publiées par d'autres utilisateurs
• Créer un compte et publier des annonces de vente, d'achat ou de service
• Contacter d'autres utilisateurs via la messagerie interne sécurisée
• Sauvegarder des recherches et recevoir des alertes personnalisées
• Accéder à des fonctionnalités réservées aux comptes professionnels

Deal & Co agit exclusivement en qualité d'hébergeur et d'intermédiaire technique. La plateforme n'est partie à aucune transaction entre utilisateurs.

Article 3 — Accès au service et création de compte
L'accès au service est réservé aux personnes majeures (18 ans et plus) ou aux personnes morales dûment représentées. La consultation des annonces est libre. La publication d'annonces, l'utilisation de la messagerie et les fonctionnalités personnalisées nécessitent la création d'un compte.

Lors de la création de votre compte, vous vous engagez à fournir des informations exactes, complètes et à jour. Vous êtes seul responsable de la confidentialité de vos identifiants. La création de comptes multiples par une même personne, ainsi que l'utilisation de fausses identités, est strictement interdite.

Article 4 — Publication d'annonces
Toute annonce publiée sur Deal & Co doit respecter la législation française et européenne en vigueur. En publiant une annonce, vous certifiez être propriétaire du bien ou habilité à proposer le service, que les informations fournies sont exactes et sincères, et que le contenu ne porte pas atteinte aux droits de tiers.

Contenus interdits :
• Les produits illicites, contrefaits ou dont la vente est réglementée sans autorisation
• Les armes, munitions et produits stupéfiants
• Les contenus à caractère pornographique, diffamatoire, haineux ou discriminatoire
• Les offres trompeuses, frauduleuses ou constituant une escroquerie
• La publication de données personnelles de tiers sans leur consentement
• Tout contenu violant les droits de propriété intellectuelle d'un tiers

Deal & Co se réserve le droit de modérer, modifier ou supprimer toute annonce non conforme, sans préavis ni indemnité.

Article 5 — Comptes professionnels
Les utilisateurs exerçant une activité commerciale à titre habituel sont tenus de créer un compte professionnel et de renseigner leur numéro SIRET. La publication d'annonces professionnelles depuis un compte particulier est contraire aux CGU.

Article 6 — Messagerie et mise en relation
La messagerie interne est destinée exclusivement aux échanges relatifs aux annonces publiées sur la plateforme. Sont interdits : le spam, le harcèlement, les tentatives de fraude, et tout contenu illicite.

Article 7 — Responsabilité des utilisateurs
Chaque utilisateur est seul responsable des contenus qu'il publie et des transactions qu'il conclut via la plateforme. Deal & Co ne garantit pas l'identité des utilisateurs, la qualité des biens ou services proposés, ni la bonne exécution des transactions.

Article 8 — Propriété intellectuelle
En publiant du contenu sur Deal & Co, vous concédez à Deal & Co une licence non exclusive, mondiale et gratuite d'utilisation de ce contenu dans le cadre du fonctionnement du service. Cette licence prend fin lors de la suppression du contenu ou du compte.

Article 9 — Suspension et résiliation de compte
Deal & Co se réserve le droit de suspendre ou de résilier un compte en cas de violation des CGU, publication de contenus illicites, comportement abusif, ou activité portant atteinte à l'intégrité de la plateforme.

Article 10 — Disponibilité du service
Deal & Co s'efforce d'assurer la disponibilité du service 24h/24 et 7j/7. Des interruptions pour maintenance peuvent survenir.

Article 11 — Paiements (fonctionnalité à venir)
Deal & Co prévoit d'intégrer des fonctionnalités de paiement sécurisé. Des Conditions Générales de Vente spécifiques seront publiées le moment venu.

Article 12 — Signalement d'abus
Tout utilisateur peut signaler une annonce ou un comportement inapproprié à : contact@dealandcompany.fr

Article 13 — Modification des CGU
Deal & Co se réserve le droit de modifier les présentes CGU. Les utilisateurs seront informés de toute modification substantielle par e-mail ou notification sur la plateforme.

Article 14 — Médiation et règlement des litiges
En cas de litige, les parties s'engagent à rechercher une solution amiable. Conformément au Code de la consommation, les consommateurs peuvent recourir à un médiateur de la consommation. Plateforme de règlement en ligne des litiges de l'UE : ec.europa.eu/consumers/odr

Article 15 — Droit applicable et juridiction
Les présentes CGU sont régies par le droit français. Tout litige sera soumis aux tribunaux français compétents.
`.trim();

const PRIVACY_TEXT = `
POLITIQUE DE CONFIDENTIALITÉ — Deal & Co
Dernière mise à jour : 11 mai 2026

1. Responsable du traitement
La plateforme Deal & Co (dealandcompany.fr) est éditée par une personne physique domiciliée en France. Contact : contact@dealandcompany.fr

Deal & Co s'engage à traiter vos données personnelles conformément au RGPD (UE 2016/679), à la loi Informatique et Libertés et à toute réglementation applicable.

2. Données personnelles collectées
Nous collectons :
• Données d'identification : nom et prénom, adresse e-mail, mot de passe (haché), numéro de téléphone (facultatif), photo de profil (facultative)
• Données pro : SIRET et raison sociale (comptes professionnels uniquement)
• Données d'annonces : titre, description, photos, prix, localisation, historique
• Données de communication : messages échangés, alertes et recherches sauvegardées, favoris
• Données techniques : adresse IP, navigateur, pages visitées, logs de connexion
• Données de localisation : ville ou code postal fourni lors de la publication (pas de GPS précis sans consentement explicite)

3. Finalités et bases légales
• Gestion du compte et authentification : exécution du contrat (art. 6.1.b)
• Publication et modération des annonces : exécution du contrat (art. 6.1.b)
• Messagerie interne : exécution du contrat (art. 6.1.b)
• Envoi de notifications et alertes : consentement (art. 6.1.a)
• Amélioration du service et statistiques : intérêt légitime (art. 6.1.f)
• Prévention de la fraude : intérêt légitime (art. 6.1.f)
• Obligations légales : obligation légale (art. 6.1.c)

4. Durée de conservation
• Données de compte actif : conservées pendant toute la durée d'activité du compte
• Après suppression : suppression sous 30 jours (sauf obligations légales)
• Annonces supprimées : conservées 12 mois à des fins de traçabilité
• Logs de connexion : conservés 12 mois maximum
• Compte inactif 3 ans : archivage après information préalable

5. Hébergement et transfert des données
Les données personnelles sont stockées au sein de l'Union européenne sur des infrastructures situées en Irlande (eu-west-1, Supabase). L'application web est déployée via Vercel. Les sociétés Supabase et Vercel sont établies aux États-Unis et encadrent les transferts par des Clauses Contractuelles Types conformément à l'article 46 du RGPD.

6. Partage des données
Vos données ne sont ni vendues, ni louées. Elles peuvent être partagées avec :
• Nos sous-traitants techniques (Vercel, Supabase) dans le cadre du service
• D'autres utilisateurs pour les informations que vous rendez publiques
• Les autorités compétentes sur réquisition judiciaire

7. Sécurité des données
• Chiffrement HTTPS (TLS) sur toutes les communications
• Mots de passe hachés (bcrypt)
• Vérification de l'adresse e-mail à l'inscription
• Accès restreint au personnel habilité
• Infrastructures certifiées ISO 27001 / SOC 2

8. Cookies et traceurs
Deal & Co utilise uniquement des cookies strictement nécessaires au fonctionnement du service (session, authentification). Aucun cookie publicitaire tiers n'est utilisé sans votre consentement explicite.

9. Vos droits RGPD
Conformément au RGPD, vous disposez des droits suivants :
• Droit d'accès (art. 15) : obtenir une copie de vos données
• Droit de rectification (art. 16) : corriger des données inexactes
• Droit à l'effacement (art. 17) : demander la suppression de vos données
• Droit à la portabilité (art. 20) : récupérer vos données en format structuré
• Droit d'opposition (art. 21) : vous opposer au traitement basé sur notre intérêt légitime
• Droit à la limitation (art. 18) : suspendre temporairement le traitement
• Droit de retirer votre consentement : à tout moment, sans effet rétroactif

Pour exercer vos droits : contact@dealandcompany.fr (réponse sous 1 mois). Vous pouvez également déposer une réclamation auprès de la CNIL (cnil.fr).

10. Suppression de compte
Vous pouvez demander la suppression de votre compte depuis les paramètres de votre profil ou par e-mail à contact@dealandcompany.fr. Suppression effective sous 30 jours.

11. Mineurs
Deal & Co est destiné aux personnes âgées d'au moins 18 ans. Nous ne collectons pas sciemment de données relatives à des mineurs.

12. Mise à jour de cette politique
En cas de modification substantielle, vous serez informé par e-mail ou notification sur le site.
`.trim();

export default function ConsentModal({ onAccept, onClose }: ConsentModalProps) {
  const [step, setStep] = useState<Step>("cgu");
  const [cguScrolled, setCguScrolled] = useState(false);
  const [privacyScrolled, setPrivacyScrolled] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  function handleScroll(
    e: React.UIEvent<HTMLDivElement>,
    setter: (v: boolean) => void,
    already: boolean
  ) {
    if (already) return;
    const el = e.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 40;
    if (nearBottom) setter(true);
  }

  const isCgu = step === "cgu";
  const canNext = isCgu ? cguScrolled : privacyScrolled;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-surface-container shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className={`w-2 h-2 rounded-full transition-colors ${isCgu ? "bg-primary" : "bg-primary/30"}`} />
              <span className={`w-2 h-2 rounded-full transition-colors ${!isCgu ? "bg-primary" : "bg-primary/30"}`} />
            </div>
            <h2 className="text-base font-extrabold text-on-surface font-['Manrope']">
              {isCgu ? "Conditions Générales d'Utilisation" : "Politique de confidentialité"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-outline hover:text-on-surface transition-colors"
            aria-label="Fermer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Indicateur de lecture */}
        <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-100 shrink-0 flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-500 text-[16px]">info</span>
          <p className="text-xs text-amber-700 font-medium">
            {canNext
              ? "✓ Lecture complète — vous pouvez continuer"
              : "Faites défiler jusqu'en bas pour continuer"}
          </p>
        </div>

        {/* Contenu scrollable */}
        {isCgu ? (
          <div
            key="cgu"
            className="flex-1 overflow-y-auto px-6 py-4 min-h-0"
            onScroll={(e) => handleScroll(e, setCguScrolled, cguScrolled)}
          >
            <pre className="whitespace-pre-wrap text-xs text-on-surface-variant font-sans leading-relaxed">
              {CGU_TEXT}
            </pre>
            <div className="h-8" />
          </div>
        ) : (
          <div
            key="privacy"
            className="flex-1 overflow-y-auto px-6 py-4 min-h-0"
            onScroll={(e) => handleScroll(e, setPrivacyScrolled, privacyScrolled)}
          >
            <pre className="whitespace-pre-wrap text-xs text-on-surface-variant font-sans leading-relaxed">
              {PRIVACY_TEXT}
            </pre>

            {/* Marketing consent — visible uniquement sur l'étape privacy */}
            <div className="mt-6 pt-5 border-t border-surface-container">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-primary rounded flex-shrink-0 cursor-pointer"
                />
                <span className="text-sm text-on-surface-variant leading-relaxed">
                  J'accepte de recevoir des e-mails sur les nouveautés et offres de Deal&amp;Co.
                  {" "}<span className="text-outline text-xs">(facultatif)</span>
                </span>
              </label>
            </div>
            <div className="h-4" />
          </div>
        )}

        {/* Footer — liens + bouton */}
        <div className="px-6 py-4 border-t border-surface-container shrink-0 space-y-3">
          {/* Liens vers pages complètes */}
          <div className="flex gap-4 justify-center">
            <Link
              href="/cgu"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[13px]">open_in_new</span>
              CGU complètes
            </Link>
            <Link
              href="/confidentialite"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[13px]">open_in_new</span>
              Politique complète
            </Link>
          </div>

          {isCgu ? (
            <button
              onClick={() => setStep("confidentialite")}
              disabled={!canNext}
              className="w-full py-3.5 bg-primary text-white font-bold rounded-2xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {canNext ? "J'ai lu les CGU — Continuer →" : "Faites défiler pour continuer"}
            </button>
          ) : (
            <button
              onClick={() => onAccept(marketingConsent)}
              disabled={!canNext}
              className="w-full py-3.5 bg-gradient-to-r from-primary to-primary-container text-white font-bold rounded-2xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shadow-[0_8px_24px_rgba(21,21,125,0.2)]"
            >
              {canNext ? "J'accepte et je crée mon compte" : "Faites défiler pour continuer"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

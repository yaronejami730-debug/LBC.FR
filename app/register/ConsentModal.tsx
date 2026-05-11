"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type Step = "cgu" | "confidentialite";

interface ConsentModalProps {
  onAccept: (marketingConsent: boolean) => void;
  onClose: () => void;
}

type Block =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] };

type Article = {
  number: string;
  title: string;
  icon: string;
  blocks: Block[];
};

const CGU_META = {
  title: "Conditions Générales d'Utilisation",
  updated: "11 mai 2026",
  intro:
    "Bienvenue sur Deal & Co. Avant de créer ton compte, prends quelques minutes pour parcourir les conditions ci-dessous.",
};

const CGU_ARTICLES: Article[] = [
  {
    number: "1",
    title: "Objet et champ d'application",
    icon: "description",
    blocks: [
      {
        type: "p",
        text: "Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme Deal & Co, accessible à l'adresse dealandcompany.fr, service de petites annonces permettant la mise en relation entre particuliers et professionnels en France.",
      },
      {
        type: "p",
        text: "En accédant à la plateforme et en créant un compte, vous reconnaissez avoir lu, compris et accepté sans réserve les présentes CGU dans leur intégralité.",
      },
    ],
  },
  {
    number: "2",
    title: "Description du service",
    icon: "view_list",
    blocks: [
      {
        type: "p",
        text: "Deal & Co est une plateforme d'intermédiation permettant à ses utilisateurs de :",
      },
      {
        type: "ul",
        items: [
          "Consulter librement des annonces publiées par d'autres utilisateurs",
          "Créer un compte et publier des annonces de vente, d'achat ou de service",
          "Contacter d'autres utilisateurs via la messagerie interne sécurisée",
          "Sauvegarder des recherches et recevoir des alertes personnalisées",
          "Accéder à des fonctionnalités réservées aux comptes professionnels",
        ],
      },
      {
        type: "p",
        text: "Deal & Co agit exclusivement en qualité d'hébergeur et d'intermédiaire technique. La plateforme n'est partie à aucune transaction entre utilisateurs.",
      },
    ],
  },
  {
    number: "3",
    title: "Accès au service et création de compte",
    icon: "person_add",
    blocks: [
      {
        type: "p",
        text: "L'accès au service est réservé aux personnes majeures (18 ans et plus) ou aux personnes morales dûment représentées. La consultation des annonces est libre. La publication d'annonces, l'utilisation de la messagerie et les fonctionnalités personnalisées nécessitent la création d'un compte.",
      },
      {
        type: "p",
        text: "Lors de la création de votre compte, vous vous engagez à fournir des informations exactes, complètes et à jour. Vous êtes seul responsable de la confidentialité de vos identifiants. La création de comptes multiples par une même personne, ainsi que l'utilisation de fausses identités, est strictement interdite.",
      },
    ],
  },
  {
    number: "4",
    title: "Publication d'annonces",
    icon: "campaign",
    blocks: [
      {
        type: "p",
        text: "Toute annonce publiée sur Deal & Co doit respecter la législation française et européenne en vigueur. En publiant une annonce, vous certifiez être propriétaire du bien ou habilité à proposer le service, que les informations fournies sont exactes et sincères, et que le contenu ne porte pas atteinte aux droits de tiers.",
      },
      { type: "p", text: "Contenus interdits :" },
      {
        type: "ul",
        items: [
          "Les produits illicites, contrefaits ou dont la vente est réglementée sans autorisation",
          "Les armes, munitions et produits stupéfiants",
          "Les contenus à caractère pornographique, diffamatoire, haineux ou discriminatoire",
          "Les offres trompeuses, frauduleuses ou constituant une escroquerie",
          "La publication de données personnelles de tiers sans leur consentement",
          "Tout contenu violant les droits de propriété intellectuelle d'un tiers",
        ],
      },
      {
        type: "p",
        text: "Deal & Co se réserve le droit de modérer, modifier ou supprimer toute annonce non conforme, sans préavis ni indemnité.",
      },
    ],
  },
  {
    number: "5",
    title: "Comptes professionnels",
    icon: "business",
    blocks: [
      {
        type: "p",
        text: "Les utilisateurs exerçant une activité commerciale à titre habituel sont tenus de créer un compte professionnel et de renseigner leur numéro SIRET. La publication d'annonces professionnelles depuis un compte particulier est contraire aux CGU.",
      },
    ],
  },
  {
    number: "6",
    title: "Messagerie et mise en relation",
    icon: "forum",
    blocks: [
      {
        type: "p",
        text: "La messagerie interne est destinée exclusivement aux échanges relatifs aux annonces publiées sur la plateforme. Sont interdits : le spam, le harcèlement, les tentatives de fraude, et tout contenu illicite.",
      },
    ],
  },
  {
    number: "7",
    title: "Responsabilité des utilisateurs",
    icon: "gavel",
    blocks: [
      {
        type: "p",
        text: "Chaque utilisateur est seul responsable des contenus qu'il publie et des transactions qu'il conclut via la plateforme. Deal & Co ne garantit pas l'identité des utilisateurs, la qualité des biens ou services proposés, ni la bonne exécution des transactions.",
      },
    ],
  },
  {
    number: "8",
    title: "Propriété intellectuelle",
    icon: "copyright",
    blocks: [
      {
        type: "p",
        text: "En publiant du contenu sur Deal & Co, vous concédez à Deal & Co une licence non exclusive, mondiale et gratuite d'utilisation de ce contenu dans le cadre du fonctionnement du service. Cette licence prend fin lors de la suppression du contenu ou du compte.",
      },
    ],
  },
  {
    number: "9",
    title: "Suspension et résiliation de compte",
    icon: "block",
    blocks: [
      {
        type: "p",
        text: "Deal & Co se réserve le droit de suspendre ou de résilier un compte en cas de violation des CGU, publication de contenus illicites, comportement abusif, ou activité portant atteinte à l'intégrité de la plateforme.",
      },
    ],
  },
  {
    number: "10",
    title: "Disponibilité du service",
    icon: "schedule",
    blocks: [
      {
        type: "p",
        text: "Deal & Co s'efforce d'assurer la disponibilité du service 24h/24 et 7j/7. Des interruptions pour maintenance peuvent survenir.",
      },
    ],
  },
  {
    number: "11",
    title: "Paiements (fonctionnalité à venir)",
    icon: "payments",
    blocks: [
      {
        type: "p",
        text: "Deal & Co prévoit d'intégrer des fonctionnalités de paiement sécurisé. Des Conditions Générales de Vente spécifiques seront publiées le moment venu.",
      },
    ],
  },
  {
    number: "12",
    title: "Signalement d'abus",
    icon: "report",
    blocks: [
      {
        type: "p",
        text: "Tout utilisateur peut signaler une annonce ou un comportement inapproprié à : contact@dealandcompany.fr",
      },
    ],
  },
  {
    number: "13",
    title: "Modification des CGU",
    icon: "update",
    blocks: [
      {
        type: "p",
        text: "Deal & Co se réserve le droit de modifier les présentes CGU. Les utilisateurs seront informés de toute modification substantielle par e-mail ou notification sur la plateforme.",
      },
    ],
  },
  {
    number: "14",
    title: "Médiation et règlement des litiges",
    icon: "handshake",
    blocks: [
      {
        type: "p",
        text: "En cas de litige, les parties s'engagent à rechercher une solution amiable. Conformément au Code de la consommation, les consommateurs peuvent recourir à un médiateur de la consommation. Plateforme de règlement en ligne des litiges de l'UE : ec.europa.eu/consumers/odr",
      },
    ],
  },
  {
    number: "15",
    title: "Droit applicable et juridiction",
    icon: "balance",
    blocks: [
      {
        type: "p",
        text: "Les présentes CGU sont régies par le droit français. Tout litige sera soumis aux tribunaux français compétents.",
      },
    ],
  },
];

const PRIVACY_META = {
  title: "Politique de confidentialité",
  updated: "11 mai 2026",
  intro:
    "On t'explique simplement quelles données on traite, pourquoi, où elles sont stockées et quels sont tes droits.",
};

const PRIVACY_ARTICLES: Article[] = [
  {
    number: "1",
    title: "Responsable du traitement",
    icon: "shield_person",
    blocks: [
      {
        type: "p",
        text: "La plateforme Deal & Co (dealandcompany.fr) est éditée par une personne physique domiciliée en France. Contact : contact@dealandcompany.fr",
      },
      {
        type: "p",
        text: "Deal & Co s'engage à traiter vos données personnelles conformément au RGPD (UE 2016/679), à la loi Informatique et Libertés et à toute réglementation applicable.",
      },
    ],
  },
  {
    number: "2",
    title: "Données personnelles collectées",
    icon: "dataset",
    blocks: [
      { type: "p", text: "Nous collectons :" },
      {
        type: "ul",
        items: [
          "Données d'identification : nom et prénom, adresse e-mail, mot de passe (haché), numéro de téléphone (facultatif), photo de profil (facultative)",
          "Données pro : SIRET et raison sociale (comptes professionnels uniquement)",
          "Données d'annonces : titre, description, photos, prix, localisation, historique",
          "Données de communication : messages échangés, alertes et recherches sauvegardées, favoris",
          "Données techniques : adresse IP, navigateur, pages visitées, logs de connexion",
          "Données de localisation : ville ou code postal fourni lors de la publication (pas de GPS précis sans consentement explicite)",
        ],
      },
    ],
  },
  {
    number: "3",
    title: "Finalités et bases légales",
    icon: "task_alt",
    blocks: [
      {
        type: "ul",
        items: [
          "Gestion du compte et authentification : exécution du contrat (art. 6.1.b)",
          "Publication et modération des annonces : exécution du contrat (art. 6.1.b)",
          "Messagerie interne : exécution du contrat (art. 6.1.b)",
          "Envoi de notifications et alertes : consentement (art. 6.1.a)",
          "Amélioration du service et statistiques : intérêt légitime (art. 6.1.f)",
          "Prévention de la fraude : intérêt légitime (art. 6.1.f)",
          "Obligations légales : obligation légale (art. 6.1.c)",
        ],
      },
    ],
  },
  {
    number: "4",
    title: "Durée de conservation",
    icon: "timer",
    blocks: [
      {
        type: "ul",
        items: [
          "Données de compte actif : conservées pendant toute la durée d'activité du compte",
          "Après suppression : suppression sous 30 jours (sauf obligations légales)",
          "Annonces supprimées : conservées 12 mois à des fins de traçabilité",
          "Logs de connexion : conservés 12 mois maximum",
          "Compte inactif 3 ans : archivage après information préalable",
        ],
      },
    ],
  },
  {
    number: "5",
    title: "Hébergement et transfert des données",
    icon: "cloud",
    blocks: [
      {
        type: "p",
        text: "Les données personnelles sont stockées au sein de l'Union européenne sur des infrastructures situées en Irlande (eu-west-1, Supabase). L'application web est déployée via Vercel. Les sociétés Supabase et Vercel sont établies aux États-Unis et encadrent les transferts par des Clauses Contractuelles Types conformément à l'article 46 du RGPD.",
      },
    ],
  },
  {
    number: "6",
    title: "Partage des données",
    icon: "share",
    blocks: [
      {
        type: "p",
        text: "Vos données ne sont ni vendues, ni louées. Elles peuvent être partagées avec :",
      },
      {
        type: "ul",
        items: [
          "Nos sous-traitants techniques (Vercel, Supabase) dans le cadre du service",
          "D'autres utilisateurs pour les informations que vous rendez publiques",
          "Les autorités compétentes sur réquisition judiciaire",
        ],
      },
    ],
  },
  {
    number: "7",
    title: "Sécurité des données",
    icon: "lock",
    blocks: [
      {
        type: "ul",
        items: [
          "Chiffrement HTTPS (TLS) sur toutes les communications",
          "Mots de passe hachés (bcrypt)",
          "Vérification de l'adresse e-mail à l'inscription",
          "Accès restreint au personnel habilité",
          "Infrastructures certifiées ISO 27001 / SOC 2",
        ],
      },
    ],
  },
  {
    number: "8",
    title: "Cookies et traceurs",
    icon: "cookie",
    blocks: [
      {
        type: "p",
        text: "Deal & Co utilise uniquement des cookies strictement nécessaires au fonctionnement du service (session, authentification). Aucun cookie publicitaire tiers n'est utilisé sans votre consentement explicite.",
      },
    ],
  },
  {
    number: "9",
    title: "Vos droits RGPD",
    icon: "verified_user",
    blocks: [
      {
        type: "p",
        text: "Conformément au RGPD, vous disposez des droits suivants :",
      },
      {
        type: "ul",
        items: [
          "Droit d'accès (art. 15) : obtenir une copie de vos données",
          "Droit de rectification (art. 16) : corriger des données inexactes",
          "Droit à l'effacement (art. 17) : demander la suppression de vos données",
          "Droit à la portabilité (art. 20) : récupérer vos données en format structuré",
          "Droit d'opposition (art. 21) : vous opposer au traitement basé sur notre intérêt légitime",
          "Droit à la limitation (art. 18) : suspendre temporairement le traitement",
          "Droit de retirer votre consentement : à tout moment, sans effet rétroactif",
        ],
      },
      {
        type: "p",
        text: "Pour exercer vos droits : contact@dealandcompany.fr (réponse sous 1 mois). Vous pouvez également déposer une réclamation auprès de la CNIL (cnil.fr).",
      },
    ],
  },
  {
    number: "10",
    title: "Suppression de compte",
    icon: "delete",
    blocks: [
      {
        type: "p",
        text: "Vous pouvez demander la suppression de votre compte depuis les paramètres de votre profil ou par e-mail à contact@dealandcompany.fr. Suppression effective sous 30 jours.",
      },
    ],
  },
  {
    number: "11",
    title: "Mineurs",
    icon: "child_care",
    blocks: [
      {
        type: "p",
        text: "Deal & Co est destiné aux personnes âgées d'au moins 18 ans. Nous ne collectons pas sciemment de données relatives à des mineurs.",
      },
    ],
  },
  {
    number: "12",
    title: "Mise à jour de cette politique",
    icon: "campaign",
    blocks: [
      {
        type: "p",
        text: "En cas de modification substantielle, vous serez informé par e-mail ou notification sur le site.",
      },
    ],
  },
];

function ArticleCard({ article }: { article: Article }) {
  return (
    <section className="group relative">
      <div className="flex items-start gap-3 mb-2.5">
        <div className="shrink-0 w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-extrabold text-sm font-['Manrope']">
          {article.number}
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary/70 text-[18px]">
              {article.icon}
            </span>
            <h3 className="text-[15px] font-extrabold text-on-surface font-['Manrope'] leading-tight">
              {article.title}
            </h3>
          </div>
        </div>
      </div>
      <div className="pl-12 space-y-3">
        {article.blocks.map((block, i) => {
          if (block.type === "p") {
            return (
              <p
                key={i}
                className="text-[13.5px] leading-relaxed text-on-surface-variant"
              >
                {block.text}
              </p>
            );
          }
          return (
            <ul key={i} className="space-y-2">
              {block.items.map((item, j) => (
                <li key={j} className="flex items-start gap-2.5">
                  <span className="mt-[7px] shrink-0 w-1.5 h-1.5 rounded-full bg-primary/60" />
                  <span className="text-[13.5px] leading-relaxed text-on-surface-variant flex-1">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          );
        })}
      </div>
    </section>
  );
}

export default function ConsentModal({ onAccept, onClose }: ConsentModalProps) {
  const [step, setStep] = useState<Step>("cgu");
  const [cguScrolled, setCguScrolled] = useState(false);
  const [privacyScrolled, setPrivacyScrolled] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [cguProgress, setCguProgress] = useState(0);
  const [privacyProgress, setPrivacyProgress] = useState(0);
  const privacyRef = useRef<HTMLDivElement>(null);

  function handleScroll(
    e: React.UIEvent<HTMLDivElement>,
    setScrolled: (v: boolean) => void,
    alreadyScrolled: boolean,
    setProgress: (v: number) => void
  ) {
    const el = e.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    const ratio = max > 0 ? Math.min(1, el.scrollTop / max) : 1;
    setProgress(ratio);
    if (!alreadyScrolled) {
      const nearBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 40;
      if (nearBottom) setScrolled(true);
    }
  }

  const isCgu = step === "cgu";
  const canNext = isCgu ? cguScrolled : privacyScrolled;
  const progress = isCgu ? cguProgress : privacyProgress;
  const meta = isCgu ? CGU_META : PRIVACY_META;
  const articles = isCgu ? CGU_ARTICLES : PRIVACY_ARTICLES;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[94dvh] sm:max-h-[88dvh] overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-5 pb-4 shrink-0 bg-gradient-to-br from-primary/[0.06] via-white to-white border-b border-surface-container">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider font-['Manrope']">
                  <span className="material-symbols-outlined text-[12px]">
                    {isCgu ? "gavel" : "shield"}
                  </span>
                  Étape {isCgu ? "1" : "2"} / 2
                </span>
                <span className="text-[10px] text-outline font-medium">
                  Mis à jour le {meta.updated}
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-on-surface font-['Manrope'] leading-tight">
                {meta.title}
              </h2>
              <p className="mt-1 text-xs text-on-surface-variant leading-relaxed">
                {meta.intro}
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-9 h-9 rounded-full bg-surface-container-low hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface transition-colors"
              aria-label="Fermer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Stepper */}
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-primary/10 overflow-hidden">
              <div className="h-full w-full bg-primary rounded-full" />
            </div>
            <div className="flex-1 h-1 rounded-full bg-primary/10 overflow-hidden">
              <div
                className={`h-full bg-primary transition-all duration-500 rounded-full ${isCgu ? "w-0" : "w-full"}`}
              />
            </div>
          </div>
        </div>

        {/* Scroll progress bar */}
        <div className="h-1 bg-surface-container-low shrink-0 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary-container transition-[width] duration-150 ease-out"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>

        {/* Content scrollable */}
        {isCgu ? (
          <div
            key="cgu"
            className="flex-1 overflow-y-auto px-6 py-5 min-h-0 scroll-smooth"
            onScroll={(e) =>
              handleScroll(e, setCguScrolled, cguScrolled, setCguProgress)
            }
          >
            <div className="space-y-6">
              {articles.map((a) => (
                <ArticleCard key={a.number} article={a} />
              ))}
            </div>
            <div className="h-4" />
          </div>
        ) : (
          <div
            key="privacy"
            ref={privacyRef}
            className="flex-1 overflow-y-auto px-6 py-5 min-h-0 scroll-smooth"
            onScroll={(e) =>
              handleScroll(
                e,
                setPrivacyScrolled,
                privacyScrolled,
                setPrivacyProgress
              )
            }
          >
            <div className="space-y-6">
              {articles.map((a) => (
                <ArticleCard key={a.number} article={a} />
              ))}
            </div>

            {/* Marketing consent — privacy step uniquement */}
            <div className="mt-7 p-4 rounded-2xl bg-primary/[0.04] border border-primary/10">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-primary rounded shrink-0 cursor-pointer"
                />
                <div className="flex-1">
                  <span className="text-[13.5px] text-on-surface leading-relaxed font-medium">
                    Recevoir des e-mails sur les nouveautés et offres de Deal&amp;Co
                  </span>
                  <p className="text-[11px] text-outline mt-0.5">
                    Facultatif — révocable à tout moment depuis ton profil.
                  </p>
                </div>
              </label>
            </div>
            <div className="h-4" />
          </div>
        )}

        {/* Lecture status */}
        <div
          className={`px-6 py-2.5 shrink-0 flex items-center gap-2 border-t transition-colors ${
            canNext
              ? "bg-emerald-50 border-emerald-100"
              : "bg-amber-50 border-amber-100"
          }`}
        >
          <span
            className={`material-symbols-outlined text-[16px] ${
              canNext ? "text-emerald-600" : "text-amber-500"
            }`}
          >
            {canNext ? "check_circle" : "arrow_downward"}
          </span>
          <p
            className={`text-xs font-medium ${
              canNext ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            {canNext
              ? "Lecture complète — tu peux continuer"
              : `Continue à faire défiler (${Math.round(progress * 100)}%)`}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-container shrink-0 space-y-3 bg-white">
          <div className="flex gap-4 justify-center">
            <Link
              href="/cgu"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[13px]">
                open_in_new
              </span>
              CGU complètes
            </Link>
            <Link
              href="/confidentialite"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[13px]">
                open_in_new
              </span>
              Politique complète
            </Link>
          </div>

          {isCgu ? (
            <button
              onClick={() => {
                setStep("confidentialite");
                privacyRef.current?.scrollTo({ top: 0 });
              }}
              disabled={!canNext}
              className="w-full py-3.5 bg-primary text-white font-bold rounded-2xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              {canNext ? (
                <>
                  J'ai lu les CGU — Continuer
                  <span className="material-symbols-outlined text-[18px]">
                    arrow_forward
                  </span>
                </>
              ) : (
                "Faites défiler pour continuer"
              )}
            </button>
          ) : (
            <button
              onClick={() => onAccept(marketingConsent)}
              disabled={!canNext}
              className="w-full py-3.5 bg-gradient-to-r from-primary to-primary-container text-white font-bold rounded-2xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] shadow-[0_8px_24px_rgba(21,21,125,0.2)] flex items-center justify-center gap-2"
            >
              {canNext ? (
                <>
                  <span className="material-symbols-outlined text-[18px]">
                    check
                  </span>
                  J'accepte et je crée mon compte
                </>
              ) : (
                "Faites défiler pour continuer"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

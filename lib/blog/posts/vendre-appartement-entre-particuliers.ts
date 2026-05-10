import type { BlogArticle } from "../types";

export const article: BlogArticle = {
  slug: "vendre-appartement-maison-entre-particuliers",
  title: "Vendre son appartement ou sa maison entre particuliers : mode d'emploi",
  description:
    "Comment vendre un bien immobilier entre particuliers sans agence en France : estimation, annonce, diagnostics obligatoires, visite et compromis de vente.",
  publishedAt: "2026-05-05",
  updatedAt: "2026-05-05",
  category: "Immobilier",
  keywords: [
    "vendre appartement particulier",
    "vente immobilière sans agence",
    "vendre maison entre particuliers",
    "diagnostics immobiliers obligatoires",
    "estimation bien immobilier",
    "compromis vente particulier",
  ],
  relatedCategoryId: "immobilier",
  intro:
    "Vendre son bien immobilier sans agence permet d'économiser 3 à 7 % du prix de vente en frais d'agence, soit plusieurs milliers d'euros sur un bien à 200 000 €. C'est tout à fait légal et de plus en plus courant, à condition de bien préparer le dossier de vente et de respecter les obligations légales.",
  sections: [
    {
      h2: "Estimer le prix de vente",
      paragraphs: [
        "Consultez les prix réels des transactions dans votre quartier sur la base de données gouvernementale DVF (Demande de Valeurs Foncières, disponible sur data.gouv.fr). Ces données recensent toutes les ventes immobilières avec leur prix, et sont bien plus fiables que les prix d'annonces affichés.",
        "Comparez avec les biens en vente actuellement dans votre immeuble ou votre rue. Tenez compte de l'étage, de l'exposition, de l'état général et des travaux récents (cuisine rénovée, salle de bains neuve = +5 à 10 %).",
        "En cas de doute, faites appel à un expert immobilier indépendant (300 à 600 €) ou à un notaire pour une estimation. C'est un investissement négligeable face aux enjeux financiers d'une vente.",
      ],
    },
    {
      h2: "Les diagnostics immobiliers obligatoires",
      paragraphs: [
        "La vente d'un bien immobilier impose un Dossier de Diagnostics Techniques (DDT) comprenant selon l'âge et la localisation du bien : DPE (Diagnostic de Performance Énergétique), état d'amiante, état des risques naturels et technologiques, diagnostic plomb (avant 1949), état de l'installation électrique et gaz (plus de 15 ans), diagnostic termites (zones à risque), bilan de l'installation d'assainissement non collectif.",
        "Ces diagnostics sont réalisés par un diagnostiqueur certifié et sont à la charge du vendeur. Comptez 300 à 700 € pour un appartement, 500 à 1 000 € pour une maison. Ils sont valables 3 à 10 ans selon le type.",
        "Depuis 2021, le DPE a un poids juridique renforcé : un bien classé F ou G peut poser des problèmes pour la vente et la location.",
      ],
    },
    {
      h2: "Rédiger et publier l'annonce",
      paragraphs: [
        "Mentionnez obligatoirement : surface Carrez en m² (loi obligatoire), nombre de pièces, étage, charges de copropriété mensuelles et nombre de lots pour un appartement, classe DPE, montant estimé des charges annuelles d'énergie.",
        "Photographiez chaque pièce en lumière naturelle, de l'angle le plus flatteur (en général depuis le coin opposé à la fenêtre). Un plan 2D ou 3D (services en ligne à partir de 50 €) augmente significativement le nombre de visites.",
        "Publiez sur Deal&Co dans la catégorie Immobilier pour atteindre des acheteurs locaux sans commission.",
      ],
    },
    {
      h2: "De la visite au compromis",
      paragraphs: [
        "Préparez un book vendeur : plans, diagnostics, derniers procès-verbaux d'assemblée générale de copropriété, factures de travaux réalisés, relevés de charges sur 3 ans. Un acheteur sérieux demandera tout cela avant de faire une offre.",
        "Une fois l'offre acceptée, la promesse ou le compromis de vente est généralement signé chez un notaire. Il est légalement possible de le rédiger soi-même mais fortement déconseillé pour un particulier non initié.",
      ],
    },
  ],
  faq: [
    {
      q: "Peut-on vendre un appartement sans agence immobilière en France ?",
      a: "Oui, c'est totalement légal. La vente entre particuliers sans agence permet d'économiser 3 à 7 % du prix de vente en frais d'agence. Il faut constituer le dossier de diagnostics, rédiger une annonce conforme et passer chez le notaire pour l'acte de vente.",
    },
    {
      q: "Quels diagnostics sont obligatoires pour vendre un appartement ?",
      a: "Le DPE, l'état des risques naturels, le diagnostic amiante et plomb (selon âge du bien), l'état de l'installation électrique et gaz, et le carnet d'information du logement. Ces diagnostics sont réalisés par un diagnostiqueur certifié et constituent le DDT.",
    },
    {
      q: "Où publier une annonce immobilière entre particuliers gratuitement ?",
      a: "Sur Deal&Co (dealandcompany.fr), catégorie Immobilier. Publication gratuite, sans commission, avec contact direct entre acheteur et vendeur.",
    },
  ],
};

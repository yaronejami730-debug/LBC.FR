import type { BlogArticle } from "../types";

export const article: BlogArticle = {
  slug: "acheter-appartement-paris-particulier",
  title: "Acheter un appartement à Paris entre particuliers : ce qu'il faut savoir",
  description:
    "Guide pour acheter un appartement à Paris directement auprès d'un particulier : estimation du prix au m², diagnostics, compromis et pièges à éviter.",
  publishedAt: "2026-05-10",
  updatedAt: "2026-05-10",
  category: "Immobilier",
  keywords: [
    "acheter appartement Paris particulier",
    "appartement Paris sans agence",
    "prix appartement Paris 2026",
    "achat immobilier Paris entre particuliers",
    "compromis vente appartement Paris",
    "diagnostics appartement Paris",
  ],
  relatedCategoryId: "immobilier",
  intro:
    "Paris reste le marché immobilier le plus tendu de France avec des prix moyens autour de 9 500 €/m² en 2026. Acheter directement auprès d'un particulier permet d'économiser les honoraires d'agence (3 à 8 % du prix), soit 10 000 à 30 000 € sur un appartement à 400 000 €.",
  sections: [
    {
      h2: "Prix au m² à Paris par arrondissement",
      paragraphs: [
        "Le prix moyen à Paris s'établit autour de 9 500 €/m² en 2026, mais avec des écarts importants selon les arrondissements. Les arrondissements les plus chers : 6e (13 000-15 000 €/m²), 7e (13 000-14 500 €/m²), 4e (12 000-14 000 €/m²). Les arrondissements les plus accessibles : 19e (7 500-9 000 €/m²), 20e (7 800-9 200 €/m²), 18e (8 500-10 000 €/m²).",
        "Les données réelles des transactions sont disponibles gratuitement sur data.gouv.fr (base DVF — Demande de Valeurs Foncières). Consultez les ventes réalisées dans l'immeuble ou la rue cible pour avoir le prix exact payé, et non les prix affichés.",
      ],
    },
    {
      h2: "Les diagnostics obligatoires à Paris",
      paragraphs: [
        "Tout appartement parisien vendu doit disposer d'un Dossier de Diagnostics Techniques (DDT) comprenant : DPE (Diagnostic de Performance Énergétique, renforcé depuis 2021), état de l'installation électrique et gaz (logements de plus de 15 ans), diagnostic amiante (constructions avant 1997), état des risques naturels et technologiques, diagnostic plomb (constructions avant 1949 — très fréquent à Paris).",
        "À Paris, le diagnostic plomb (CREP) est quasi-systématique vu l'ancienneté du bâti. Une concentration en plomb supérieure aux seuils réglementaires peut imposer des travaux au vendeur. Le DPE est crucial : depuis 2025, les biens classés G ne peuvent plus être loués, ce qui affecte la valeur des investissements locatifs.",
      ],
    },
    {
      h2: "Vérifier la copropriété",
      paragraphs: [
        "Exigez les trois derniers procès-verbaux d'assemblée générale de copropriété. Ils révèlent les travaux votés ou prévus (ravalement, toiture, ascenseur) qui pourraient vous être facturés après l'achat. Demandez aussi le carnet d'entretien de l'immeuble et le pré-état daté (situation des charges au moment de la vente).",
        "À Paris, méfiez-vous des copropriétés avec des charges anormalement basses (sous-entretien) ou très élevées (immeuble en mauvais état). Le taux d'impayés de charges dans la copropriété est un signal important : au-delà de 15 %, la copropriété peut être en difficulté financière.",
      ],
    },
    {
      h2: "Le compromis de vente entre particuliers",
      paragraphs: [
        "Le compromis (ou promesse de vente) peut être signé sans agence, mais toujours devant un notaire ou entre particuliers. Entre particuliers, le notaire de l'acheteur peut rédiger l'acte (les honoraires sont partagés entre acheteur et vendeur). Pour un appartement parisien, ne signez jamais un compromis rédigé par un non-professionnel : les clauses suspensives (financement, copropriété) sont trop techniques.",
        "Après la signature du compromis, l'acheteur dispose de 10 jours de rétractation. Le versement d'un acompte (généralement 5 à 10 % du prix) est bloqué chez le notaire jusqu'à la signature de l'acte définitif.",
      ],
    },
  ],
  faq: [
    {
      q: "Quel est le prix moyen au m² à Paris en 2026 ?",
      a: "Le prix moyen à Paris est d'environ 9 500 €/m² en 2026. Il varie de 7 500 €/m² dans le 19e arrondissement à plus de 14 000 €/m² dans le 6e et 7e. Consultez la base DVF sur data.gouv.fr pour les prix réels des transactions dans le quartier ciblé.",
    },
    {
      q: "Comment acheter un appartement à Paris sans agence ?",
      a: "Recherchez des annonces de particuliers sur Deal&Co dans la catégorie Immobilier. Une fois un bien trouvé, faites appel à un notaire pour la rédaction du compromis et de l'acte de vente. Vous économisez ainsi les honoraires d'agence (3 à 8 % du prix).",
    },
    {
      q: "Quels diagnostics sont obligatoires pour acheter un appartement à Paris ?",
      a: "DPE, état de l'installation électrique et gaz, diagnostic amiante, état des risques, et très souvent le diagnostic plomb (CREP) pour les immeubles anciens. Ces diagnostics sont fournis par le vendeur dans le Dossier de Diagnostics Techniques.",
    },
  ],
};

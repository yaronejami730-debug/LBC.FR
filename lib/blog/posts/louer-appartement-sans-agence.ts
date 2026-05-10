import type { BlogArticle } from "../types";

export const article: BlogArticle = {
  slug: "louer-appartement-sans-agence-guide",
  title: "Louer un appartement sans agence entre particuliers : guide complet",
  description:
    "Comment louer un appartement directement auprès d'un propriétaire en France : recherche, dossier de location, bail, caution et état des lieux.",
  publishedAt: "2026-05-10",
  updatedAt: "2026-05-10",
  category: "Immobilier",
  keywords: [
    "louer appartement sans agence",
    "location particulier à particulier",
    "bail location particulier",
    "dossier de location particulier",
    "location sans frais d'agence",
    "trouver appartement particulier",
  ],
  relatedCategoryId: "immobilier",
  intro:
    "En France, les honoraires d'agence sont à la charge du locataire et peuvent représenter 1 à 1,5 mois de loyer, soit 700 à 1 500 € pour un appartement de 800 €/mois. Louer directement auprès d'un propriétaire particulier permet d'éviter ces frais et de négocier plus librement les conditions de location.",
  sections: [
    {
      h2: "Où trouver des appartements à louer entre particuliers",
      paragraphs: [
        "Deal&Co dans la catégorie Immobilier permet de consulter des annonces de propriétaires particuliers sans passer par une agence. Contrairement aux grands portails qui mélangent annonces d'agences et particuliers, Deal&Co est exclusivement entre particuliers, sans commission.",
        "Rejoignez également les groupes Facebook de votre ville dédiés à la location entre particuliers, consultez les tableaux d'affichage des grandes écoles et universités (pour les petites surfaces), et demandez dans votre réseau — une grande partie des logements se louent sans annonce publique.",
      ],
    },
    {
      h2: "Constituer un dossier de location solide",
      paragraphs: [
        "Un propriétaire particulier évalue votre solvabilité sans l'outil de scoring des agences. Préparez un dossier complet : pièce d'identité, 3 dernières fiches de paie, dernier avis d'imposition, justificatif de domicile actuel, contrat de travail (CDI de préférence) ou attestation employeur. Si vous êtes en CDD ou indépendant, ajoutez un garant avec des revenus stables.",
        "Le revenu mensuel net doit généralement représenter 3 fois le loyer charges comprises. Si ce n'est pas le cas, proposez un garant (parent, ami) ou une caution bancaire (Visale, la garantie de la caisse des dépôts, gratuite pour les moins de 30 ans et les salariés précaires).",
      ],
    },
    {
      h2: "La rédaction du bail entre particuliers",
      paragraphs: [
        "Le bail de location résidence principale doit respecter la loi Alur de 2014. Utilisez le modèle de contrat type défini par décret gouvernemental (disponible sur service-public.fr). Ce modèle est obligatoire pour les locations nues et meublées de résidence principale.",
        "Éléments indispensables dans le bail : identité des deux parties, description du logement et de ses annexes, date de prise d'effet et durée (3 ans nu, 1 an meublé), montant du loyer et des charges, montant du dépôt de garantie (1 mois nu, 2 mois meublé), liste des équipements fournis pour un meublé.",
      ],
    },
    {
      h2: "L'état des lieux : pièce maîtresse",
      paragraphs: [
        "L'état des lieux d'entrée est obligatoire et doit être contradictoire (signé par les deux parties). Soyez minutieux : photographiez chaque mur, chaque meuble, chaque équipement. Notez la moindre rayure, tâche ou défaut. L'état des lieux de sortie sera comparé à celui d'entrée pour déterminer les éventuelles retenues sur le dépôt de garantie.",
        "Le propriétaire dispose de 1 mois pour restituer le dépôt de garantie si l'état des lieux de sortie est conforme, 2 mois s'il y a des travaux à déduire. Au-delà, il doit des intérêts au locataire.",
      ],
    },
  ],
  faq: [
    {
      q: "Comment trouver un appartement à louer sans frais d'agence ?",
      a: "Consultez les annonces de propriétaires particuliers sur Deal&Co (dealandcompany.fr), catégorie Immobilier > Locations. Vous êtes en contact direct avec le propriétaire, sans frais d'agence.",
    },
    {
      q: "Quel est le bail légal pour une location entre particuliers ?",
      a: "Vous devez utiliser le contrat type défini par décret gouvernemental, disponible sur service-public.fr. Il est obligatoire pour les résidences principales, nues ou meublées.",
    },
    {
      q: "Peut-on louer sans être propriétaire (sous-location) ?",
      a: "La sous-location est interdite sans l'accord écrit du propriétaire. En cas de sous-location non autorisée, le locataire principal risque la résiliation de son bail.",
    },
  ],
};

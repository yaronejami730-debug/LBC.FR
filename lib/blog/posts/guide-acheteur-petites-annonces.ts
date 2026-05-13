import type { BlogArticle } from "../types";

export const article: BlogArticle = {
  slug: "guide-acheteur-petites-annonces-france",
  title: "Guide de l'acheteur sur les petites annonces : tout ce qu'il faut savoir",
  description:
    "Comment acheter en toute sécurité sur les sites de petites annonces en France : vérifications, négociation, rendez-vous, paiement et recours en cas de problème.",
  publishedAt: "2026-05-03",
  updatedAt: "2026-05-03",
  category: "Conseils",
  keywords: [
    "guide acheteur petites annonces",
    "sécurité achat occasion",
    "négocier prix annonce",
    "rendez-vous achat occasion",
    "paiement sécurisé particulier",
    "droits acheteur particulier",
  ],
  relatedCategoryId: undefined,
  intro:
    "Acheter sur les petites annonces entre particuliers est économique mais demande quelques précautions. Contrairement à un achat en magasin, il n'y a pas de garantie légale automatique et peu de recours en cas de problème. Ces conseils vous permettent de maximiser vos chances d'un achat réussi.",
  sections: [
    {
      h2: "Analyser une annonce avec esprit critique",
      paragraphs: [
        "Une bonne annonce comporte : plusieurs photos nettes depuis différents angles, une description précise avec les défauts mentionnés, un prix cohérent avec le marché, et un vendeur joignable rapidement. Une annonce avec une seule photo floue, une description vague et un prix anormalement bas doit éveiller la méfiance.",
        "Vérifiez la cohérence des informations : un téléphone 'comme neuf' ne doit pas avoir une batterie à 72 %. Une voiture 'jamais accidentée' doit avoir des panneaux bien alignés. Un sac de marque 'authentique' doit avoir des photos du numéro de série.",
        "Utilisez la recherche inverse d'image (Google Images, TinEye) sur les photos de l'annonce : si elles apparaissent sur d'autres sites ou ventes, c'est un signal d'arnaque potentielle.",
      ],
    },
    {
      h2: "Premier contact et échanges avec le vendeur",
      paragraphs: [
        "Posez des questions précises sur les points qui vous semblent flous. Un vendeur honnête répond clairement et peut envoyer des photos supplémentaires. Un vendeur évasif ou qui pressent à conclure rapidement ('je pars à l'étranger demain', 'j'ai plusieurs acheteurs') est suspect.",
        "Méfiez-vous des vendeurs qui ne peuvent pas vous rencontrer en personne et proposent l'envoi avec paiement à l'avance. C'est le schéma classique de l'arnaque à la petite annonce.",
      ],
    },
    {
      h2: "Organiser le rendez-vous",
      paragraphs: [
        "Rencontrez-vous toujours dans un lieu public et en journée. Un parking de supermarché, la terrasse d'un café ou le parvis d'une mairie sont idéaux. N'allez jamais seul chez un inconnu pour un achat important.",
        "Pour un achat coûteux (voiture, équipement professionnel), venez avec quelqu'un. Deux paires d'yeux valent mieux qu'une, et la présence d'un tiers réduit le risque de tentative de manipulation.",
      ],
    },
    {
      h2: "Le paiement sécurisé",
      paragraphs: [
        "Pour les petites sommes (moins de 300 €) : les espèces sont pratiques et sans risque. Pour les sommes moyennes (300 à 1 500 €) : le virement bancaire instantané est traçable et sûr. Pour les grosses sommes (au-delà de 1 500 €) : virement bancaire vérifié avant remise ou chèque de banque (vérifiable auprès de la banque émettrice).",
        "Évitez : PayPal Amis & Famille (pas de protection acheteur), virement Western Union ou MoneyGram (non traçable, impossible à annuler), et les chèques ordinaires (peuvent être en bois).",
      ],
    },
    {
      h2: "Vos droits en cas de problème",
      paragraphs: [
        "Entre particuliers, le vendeur n'est pas soumis à la garantie légale de conformité (réservée aux professionnels). Mais il reste tenu de la garantie des vices cachés : si un défaut existait avant la vente, était caché et rend l'objet inutilisable, vous pouvez demander l'annulation de la vente ou une réduction de prix devant le tribunal.",
        "Conservez tous les échanges (messages, emails) et le certificat de cession ou reçu signé. Ces documents sont vos preuves en cas de litige.",
      ],
    },
    {
      h2: "Sources et méthodologie",
      paragraphs: [
        "Cet article s'appuie sur les ressources officielles applicables aux échanges entre particuliers : service-public.fr (rubriques consommation, vente entre particuliers, cession), Direction générale de la Concurrence, de la Consommation et de la Répression des fraudes DGCCRF (economie.gouv.fr/dgccrf), Commission nationale de l'informatique et des libertés CNIL (cnil.fr) pour les obligations relatives aux données personnelles.",
        "Les éléments relatifs à l'économie circulaire et au réemploi s'appuient sur la documentation de l'ADEME (ademe.fr) et sur les rapports publics de la Cour des comptes et de l'Institut national de la consommation (INC / 60 Millions de consommateurs).",
        "Les ordres de grandeur cités reflètent les tendances convergentes observées entre ces sources publiques. Les bonnes pratiques évoluent avec la réglementation et les outils proposés par les plateformes ; vérifier les éléments réglementaires sur les sources officielles avant toute décision importante.",
      ],
    },
  ],
  faq: [
    {
      q: "Comment payer en toute sécurité sur les petites annonces ?",
      a: "Espèces pour les petites sommes, virement bancaire instantané pour les montants moyens (300-1 500 €), chèque de banque vérifié pour les grosses sommes. Évitez PayPal Amis & Famille, Western Union et les chèques ordinaires.",
    },
    {
      q: "Quels sont mes droits si l'article acheté entre particuliers ne fonctionne pas ?",
      a: "Entre particuliers, il n'y a pas de garantie légale de conformité. Mais la garantie des vices cachés s'applique : si un défaut existait avant la vente et était dissimulé, vous pouvez agir en justice pour annulation ou réduction du prix.",
    },
    {
      q: "Comment éviter les arnaques sur les petites annonces ?",
      a: "Rencontrez-vous toujours en personne dans un lieu public. Méfiez-vous des vendeurs qui proposent l'envoi avec paiement à l'avance. Vérifiez la cohérence des photos (recherche inverse d'image). Ne payez jamais avant d'avoir inspecté l'article.",
    },
  ],
};

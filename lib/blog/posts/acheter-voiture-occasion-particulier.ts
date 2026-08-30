import type { BlogArticle } from "../types";

export const article: BlogArticle = {
  slug: "acheter-voiture-occasion-entre-particuliers",
  title: "Comment acheter une voiture d'occasion entre particuliers : le guide complet",
  description:
    "Guide complet pour acheter une voiture d'occasion entre particuliers en France : points à vérifier, documents obligatoires, essai, négociation et pièges à éviter.",
  publishedAt: "2026-05-01",
  updatedAt: "2026-05-01",
  category: "Véhicules",
  keywords: [
    "acheter voiture occasion particulier",
    "contrôle voiture occasion",
    "documents achat voiture",
    "vérification voiture occasion",
    "négocier voiture occasion",
    "pièges achat voiture particulier",
  ],
  relatedCategoryId: "vehicules",
  intro:
    "Acheter une voiture entre particuliers permet d'économiser 20 à 40 % par rapport à un concessionnaire, mais comporte des risques réels : kilométrage trafiqué, problèmes mécaniques cachés, situation administrative douteuse. Ce guide vous donne tous les outils pour acheter en connaissance de cause.",
  sections: [
    {
      h2: "Vérifier le véhicule avant le rendez-vous",
      paragraphs: [
        "Commencez par demander la plaque d'immatriculation ou le numéro de formule et vérifiez l'historique du véhicule sur le site officiel histovec.interieur.gouv.fr (gratuit). Vous y verrez les changements de propriétaire, les contrôles techniques passés et les éventuelles déclarations de sinistre.",
        "Vérifiez sur Cartgris.gouv.fr que la carte grise est au nom du vendeur et que le véhicule n'est pas gagé (gage signifie que le véhicule est utilisé comme garantie pour un crédit non soldé).",
        "Si le kilométrage affiché paraît suspect (trop bas pour l'âge du véhicule), croisez avec les contrôles techniques sur Histovec : chaque CT enregistre le kilométrage.",
      ],
    },
    {
      h2: "L'inspection physique : ce qu'il faut regarder",
      paragraphs: [
        "Extérieur : vérifiez l'alignement des panneaux de carrosserie (portes, capot, coffre). Des jeux inégaux signalent un accident réparé. Regardez sous les passages de roue et dans le coffre pour détecter des traces de rouille ou de débosselage. Examinez les seuils de portes.",
        "Intérieur : état des sièges, volant usé (signe de kilométrage élevé), fonctionnement de tous les boutons (climatisation, vitre électrique, rétroviseurs). Odeur de moisissure signale une infiltration d'eau.",
        "Moteur : ouvrez le capot, vérifiez le niveau et la couleur des huiles (huile moteur noire comme du goudron = problème), traces de fuite sur les joints, état de la courroie de distribution si visible. Démarrez froid : un moteur qui fume en démarrant à froid peut signaler une usure avancée.",
      ],
    },
    {
      h2: "L'essai routier obligatoire",
      paragraphs: [
        "N'achetez jamais sans essai. Empruntez plusieurs types de route : ville, voie rapide, ralentisseurs. Testez les freinages d'urgence (dans un endroit sûr), les accélérations, les changements de vitesse. Écoutez les bruits anormaux (grincement, claquement, frottement).",
        "En ville, faites des créneaux pour vérifier la direction. Sur route, lâchez brièvement le volant : la voiture ne doit pas tirer d'un côté (signe de géométrie ou de pneumatiques usés inégalement).",
        "Demandez à voir un professionnel indépendant si vous avez le moindre doute. Des services comme Dekra ou Autovision proposent des expertises pré-achat pour 100 à 200 €, largement rentabilisées sur une voiture à 5 000 €.",
      ],
    },
    {
      h2: "Les documents indispensables",
      paragraphs: [
        "Exigez : carte grise barrée au nom du vendeur, contrôle technique de moins de 6 mois pour les véhicules de plus de 4 ans, certificat de situation administrative (non-gage, téléchargeable sur cartegrise.gouv.fr), certificat de cession (Cerfa 15776).",
        "Le vendeur doit barrer la carte grise, y inscrire 'Vendu le [date]' et signer. Vous devez faire la demande de carte grise à votre nom dans les 30 jours sur le site de l'ANTS.",
      ],
    },
    {
      h2: "Négocier le prix",
      paragraphs: [
        "Comparez les annonces similaires sur Deal&Co avant le rendez-vous. Notez les défauts constatés et chiffrez leur réparation (devis en ligne sur les forums auto). Proposez un premier prix 10 à 15 % sous votre offre finale.",
        "Restez factuel : 'Les pneus avant sont à remplacer, soit 200 €. Le filtre à particules est encrassé, soit 150 € de prestation. Je propose X €.' Les émotions n'ont pas leur place dans la négociation.",
      ],
    },
  ],
  faq: [
    {
      q: "Comment vérifier qu'une voiture d'occasion n'est pas accidentée ?",
      a: "Consultez histovec.interieur.gouv.fr avec la plaque d'immatriculation : les sinistres déclarés y apparaissent. Vérifiez physiquement l'alignement des panneaux de carrosserie. En cas de doute, faites une expertise pré-achat (Dekra, Autovision).",
    },
    {
      q: "Quels documents sont obligatoires pour acheter une voiture entre particuliers ?",
      a: "Carte grise barrée et signée par le vendeur, contrôle technique de moins de 6 mois (véhicules +4 ans), certificat de situation administrative (non-gage) et certificat de cession Cerfa 15776.",
    },
    {
      q: "Où trouver des voitures d'occasion entre particuliers en France ?",
      a: "Sur Deal&Co (dealandcompany.fr), catégorie Véhicules, vous trouvez des annonces de particuliers partout en France, avec photos, kilométrage et description détaillée. Publication et consultation gratuites.",
    },
  ],
};

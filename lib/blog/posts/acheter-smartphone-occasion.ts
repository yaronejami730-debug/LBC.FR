import type { BlogArticle } from "../types";

export const article: BlogArticle = {
  slug: "acheter-smartphone-occasion-particulier",
  title: "Comment acheter un smartphone d'occasion entre particuliers sans se faire avoir",
  description:
    "Guide pour acheter un iPhone ou Android d'occasion en toute sécurité : points à vérifier, prix du marché, tests à effectuer et arnaques à éviter.",
  publishedAt: "2026-04-25",
  updatedAt: "2026-05-01",
  category: "Multimédia",
  keywords: [
    "acheter iphone occasion",
    "smartphone occasion particulier",
    "iphone reconditionné particulier",
    "vérifier iphone occasion",
    "acheter android occasion",
    "téléphone occasion arnaques",
  ],
  relatedCategoryId: "multimedia",
  intro:
    "Acheter un smartphone d'occasion entre particuliers peut faire économiser 30 à 60 % par rapport au neuf, mais comporte des risques spécifiques : téléphone volé, bloqué opérateur, IMEI signalé ou dégâts cachés. Avec les bons réflexes, vous pouvez acheter en toute sécurité.",
  sections: [
    {
      h2: "Vérifier l'IMEI avant tout",
      paragraphs: [
        "L'IMEI est le numéro d'identité unique du téléphone (15 chiffres). Demandez-le au vendeur avant le rendez-vous et vérifiez-le sur imei.info ou la base GSMA. Un IMEI signalé volé ou perdu doit être un motif de refus immédiat.",
        "Sur iPhone, composez *#06# pour afficher l'IMEI. Vérifiez aussi sur le boîtier d'origine si disponible. Les numéros doivent correspondre.",
        "Vérifiez également que le téléphone n'est pas bloqué opérateur (SIM-lock). Pour un iPhone, la rubrique Réglages > Général > Informations indique si l'appareil est déverrouillé.",
      ],
    },
    {
      h2: "Les tests à effectuer au rendez-vous",
      paragraphs: [
        "Testez systématiquement : écran tactile sur toute la surface, appareil photo (photo et vidéo, caméra avant et arrière), haut-parleurs, microphone (appel test), Face ID ou Touch ID, WiFi, Bluetooth, GPS, prise de charge. Sur iPhone, consultez Réglages > Batterie > État de la batterie : en dessous de 80 %, la batterie est en fin de vie.",
        "Vérifiez les coins et les bords pour détecter des traces de chocs qui indiqueraient une chute. Un écran remplacé par un atelier tiers peut être détecté sur iPhone récent (message dans Réglages > Général).",
        "Demandez au vendeur de se déconnecter de son compte Apple ID ou Google avant la transaction. Un iPhone avec un compte Apple ID actif est inutilisable : c'est la protection Activation Lock.",
      ],
    },
    {
      h2: "Prix du marché pour les smartphones d'occasion",
      paragraphs: [
        "iPhone 15 (128 Go, bon état) : 650 à 750 €. iPhone 14 : 450 à 550 €. iPhone 13 : 350 à 430 €. Samsung Galaxy S24 : 550 à 650 €. Ces prix varient selon l'état, la couleur et le stockage. Comparez les annonces similaires sur Deal&Co avant de vous déplacer.",
        "Méfiez-vous des prix anormalement bas (plus de 30 % sous la moyenne du marché) : c'est souvent le signe d'un appareil volé, cassé ou d'une arnaque.",
      ],
    },
    {
      h2: "Sécuriser la transaction",
      paragraphs: [
        "Rencontrez-vous dans un lieu public (café, centre commercial). Payez en espèces ou par virement instantané confirmé. Évitez PayPal Amis & Famille (pas de protection acheteur) et les virements hors zone SEPA.",
        "Demandez une facture manuscrite signée indiquant : date, IMEI, prix, nom et coordonnées du vendeur. Cela vous protège en cas de litige.",
      ],
    },
    {
      h2: "Sources et méthodologie",
      paragraphs: [
        "Cet article s'appuie sur la documentation publique des constructeurs officiels (Apple, Samsung, Sony, Microsoft, etc.), sur les fiches techniques accessibles sur leurs sites support, et sur les guides de l'Institut national de la consommation (INC / 60 Millions de consommateurs) consacrés à l'électronique d'occasion.",
        "Les modalités relatives au reconditionné et à la garantie légale reposent sur le Code de la consommation consultable sur legifrance.gouv.fr et sur les fiches de la DGCCRF. La labellisation des reconditionneurs s'appuie sur les normes Afnor NF S97-130 et NF EN 50614.",
        "Les ordres de grandeur de prix et de fiabilité cités correspondent aux tendances observées dans les baromètres publics des comparateurs spécialisés et des médias techniques de référence.",
      ],
    },
  ],
  faq: [
    {
      q: "Comment vérifier qu'un iPhone d'occasion n'est pas volé ?",
      a: "Demandez l'IMEI (composez *#06# sur le téléphone) et vérifiez-le sur imei.info. Vérifiez aussi que l'iPhone n'a pas de compte Apple ID actif (Activation Lock) : l'appareil doit être déverrouillé avant la transaction.",
    },
    {
      q: "Où acheter un smartphone d'occasion entre particuliers en France ?",
      a: "Sur Deal&Co (dealandcompany.fr), catégorie Multimédia, vous trouverez des annonces de smartphones d'occasion publiées par des particuliers partout en France, sans commission.",
    },
    {
      q: "Quel prix payer pour un iPhone occasion entre particuliers ?",
      a: "iPhone 15 : 650-750 €. iPhone 14 : 450-550 €. iPhone 13 : 350-430 €. En dessous de ces fourchettes, vérifiez l'état et l'IMEI avec soin.",
    },
  ],
};

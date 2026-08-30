import type { BlogArticle } from "../types";

export const article: BlogArticle = {
  slug: "estimer-loyer-appartement-location",
  title: "Estimer le loyer d'un appartement avant de le mettre en location",
  description:
    "Méthode pour fixer le bon loyer d'un appartement : prix au m² par ville, encadrement des loyers, charges, et stratégies pour louer rapidement.",
  publishedAt: "2026-04-22",
  updatedAt: "2026-04-22",
  category: "Immobilier",
  keywords: [
    "estimer loyer appartement",
    "prix loyer m2",
    "encadrement des loyers",
    "louer appartement entre particuliers",
    "fixer loyer location",
  ],
  relatedCategoryId: "immobilier",
  intro:
    "Fixer le bon loyer pour un appartement détermine la rapidité de location et le rendement de votre bien. Un loyer trop élevé prolonge la vacance locative et coûte plus cher qu'une légère décote. Un loyer trop bas réduit le rendement net et complique les futures révisions. Cet article détaille la méthode pour estimer un loyer juste, en tenant compte du marché local, de l'encadrement et des spécificités du bien.",
  sections: [
    {
      h2: "Connaître le prix au m² de référence dans votre ville",
      paragraphs: [
        "La première étape consiste à identifier le loyer médian au mètre carré dans votre quartier précis. Les observatoires locaux des loyers (OLL) publient ces données pour les principales agglomérations. À défaut, comparez les annonces actives sur les sites de petites annonces pour des biens similaires : même nombre de pièces, étage proche, présence ou non d'ascenseur, balcon, parking.",
        "Le prix au m² dépend fortement du quartier au sein d'une même ville. À Paris, l'écart entre le 19e arrondissement et le 7e dépasse 50 %. À Lyon, entre Croix-Rousse et Confluence, l'écart atteint 25 %. Ne raisonnez pas à l'échelle de la ville mais à celle du quartier ou de l'arrondissement.",
        "Pondérez le prix médian par les caractéristiques différenciantes : un T2 de 45 m² au 5e étage avec ascenseur et balcon vaudra 5 à 10 % de plus qu'un même T2 au rez-de-chaussée sans extérieur. Inversement, un appartement traversant ou avec une vue dégagée justifie une légère prime.",
      ],
    },
    {
      h2: "Vérifier si vous êtes en zone d'encadrement",
      paragraphs: [
        "L'encadrement des loyers s'applique dans plusieurs grandes villes françaises (Paris, Lille, Lyon, Villeurbanne, Bordeaux, Montpellier, Plaine Commune, Est Ensemble). Le loyer ne peut excéder un plafond fixé par arrêté préfectoral, calculé selon le type de bien, l'année de construction, le nombre de pièces et la zone géographique précise.",
        "Pour vérifier le plafond applicable, utilisez le simulateur officiel de votre commune (par exemple drihl.ile-de-france.developpement-durable.gouv.fr pour Paris). Saisissez l'adresse exacte, le nombre de pièces, la surface habitable, l'année de construction et le caractère meublé ou non. Le simulateur affiche le loyer de référence majoré au-delà duquel vous ne pouvez pas aller.",
        "Le complément de loyer reste possible si votre bien présente des caractéristiques exceptionnelles non prises en compte (terrasse de plus de 9 m², vue remarquable, prestations de standing). Ces éléments doivent figurer explicitement dans le bail et être justifiables en cas de contestation.",
      ],
    },
    {
      h2: "Distinguer loyer hors charges et charges locatives",
      paragraphs: [
        "Le loyer affiché est en principe hors charges. Les charges locatives (provisions sur charges) couvrent l'eau froide, l'entretien des parties communes, l'ascenseur, le chauffage collectif et la taxe d'enlèvement des ordures ménagères. Elles s'ajoutent au loyer principal et font l'objet d'une régularisation annuelle.",
        "Pour estimer le montant des charges, basez-vous sur le décompte de l'année précédente fourni par votre syndic ou par votre comptabilité personnelle si vous avez déjà loué. À défaut, comptez 25 à 50 € par mois pour un T2 sans ascenseur, 50 à 100 € pour un T3 avec ascenseur et chauffage collectif.",
        "Indiquez clairement dans l'annonce le loyer hors charges, le montant des provisions sur charges et le total mensuel. Les locataires comparent surtout le total : un loyer affiché 700 € + 50 € de charges sera plus attractif qu'un 720 € + 60 € même si le second est légèrement plus cher.",
      ],
    },
    {
      h2: "Adapter le loyer à la stratégie de mise en location",
      paragraphs: [
        "Si votre objectif est de louer rapidement (vacance limitée à un mois), positionnez le loyer dans la moyenne basse du marché local — environ 5 % en dessous des biens comparables. Vous attirerez plus de candidats sérieux et pourrez sélectionner sur dossier sans pression du temps.",
        "Si vous pouvez attendre deux à trois mois, fixez le loyer dans la moyenne haute. Vous testerez le marché et pourrez ajuster si les visites tardent. Évitez le piège du loyer maximal qui rallonge la vacance : un mois sans loyer représente déjà 8 % de pertes annuelles.",
        "Pour un investissement locatif, privilégiez la rotation modérée à un loyer optimal. Un locataire stable qui paie 750 € pendant cinq ans rapporte plus qu'une succession de locataires à 800 € avec deux mois de vacance entre chaque bail. La fidélisation passe par un loyer juste et un entretien réactif du logement.",
      ],
    },
    {
      h2: "Réviser le loyer en cours de bail",
      paragraphs: [
        "Le loyer ne peut être révisé qu'une fois par an, à la date anniversaire du bail, et uniquement si une clause de révision figure au contrat. La hausse est plafonnée par l'évolution de l'Indice de Référence des Loyers (IRL) publié trimestriellement par l'INSEE.",
        "À chaque date anniversaire, calculez le nouveau loyer selon la formule : loyer initial × (IRL trimestre de référence du nouveau calcul / IRL trimestre de référence à la signature). Notifiez le locataire par simple courrier en mentionnant l'ancienne valeur, la nouvelle valeur et le calcul. Pas besoin de recommandé.",
        "Si vous oubliez la révision pendant plusieurs années, vous ne pouvez réclamer la hausse rétroactive que sur les douze mois précédents. Mieux vaut donc paramétrer un rappel automatique à chaque date anniversaire pour ne pas perdre cette indexation légitime.",
      ],
    },
  ],
  faq: [
    {
      q: "Combien coûte un T2 en moyenne en France ?",
      a: "En 2026, le loyer médian d'un T2 de 45 m² varie d'environ 1 100 € à Paris intramuros à 450-550 € dans une ville moyenne. Le prix au m² médian s'établit autour de 24 €/m² à Paris, 14 €/m² à Lyon, 10-12 €/m² dans la plupart des grandes villes de province.",
    },
    {
      q: "Puis-je dépasser le plafond de l'encadrement des loyers ?",
      a: "Uniquement avec un complément de loyer justifié par des caractéristiques exceptionnelles (terrasse de plus de 9 m², vue remarquable, prestations de standing) qui doivent être détaillées dans le bail. À défaut, le locataire peut demander une diminution.",
    },
    {
      q: "Quand puis-je réviser le loyer ?",
      a: "Une fois par an à la date anniversaire du bail, à condition que la clause d'indexation IRL figure au contrat. La hausse est limitée à l'évolution de l'IRL publié par l'INSEE.",
    },
    {
      q: "Faut-il louer meublé ou vide ?",
      a: "Le meublé permet un loyer 10 à 20 % supérieur, des baux plus courts (1 an, 9 mois pour étudiants) et un régime fiscal avantageux (LMNP). En contrepartie, la rotation est plus élevée et l'entretien du mobilier reste à votre charge.",
    },
  ],
};

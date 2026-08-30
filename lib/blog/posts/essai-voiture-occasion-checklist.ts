import type { BlogArticle } from "../types";

export const article: BlogArticle = {
  slug: "essai-voiture-occasion-checklist",
  title: "Essai voiture d'occasion : la checklist complète du pro",
  description:
    "Essai voiture d'occasion : 30 points à vérifier avant d'acheter. Inspection extérieure, intérieure, mécanique et essai routier. Le guide complet.",
  publishedAt: "2026-05-01",
  updatedAt: "2026-05-01",
  category: "Véhicules",
  keywords: [
    "essai voiture occasion",
    "checklist achat voiture",
    "essayer voiture occasion",
    "vérifications voiture occasion",
    "inspection voiture occasion",
    "essai voiture avant achat",
  ],
  relatedCategoryId: "vehicules",
  intro:
    "L'essai d'une voiture d'occasion est l'étape la plus importante avant la signature. Trente minutes bien employées peuvent vous épargner 3 000 € de réparations à venir et un cauchemar judiciaire en cas de vice caché. Cette checklist passe en revue les trente points à vérifier méthodiquement, depuis l'inspection extérieure jusqu'au démarrage à froid et à l'essai routier. Imprimez-la avant d'aller voir le véhicule.",
  sections: [
    {
      h2: "Avant le rendez-vous : préparation",
      paragraphs: [
        "Préparez votre dossier de questions avant la visite. Demandez par téléphone ou message au vendeur les éléments suivants : carnet d'entretien complet et factures, dernier contrôle technique, type de propriétaire (privé, professionnel, ancien locataire de longue durée), historique des sinistres déclarés, motif réel de la vente.",
        "Apportez avec vous : une lampe torche puissante (LED), un aimant fin (pour vérifier les réparations de carrosserie), un mètre ruban, un mouchoir blanc (pour le test du pot d'échappement), votre téléphone avec connexion internet (pour Histovec), et idéalement un compagnon de visite (deux paires d'yeux valent mieux qu'une).",
        "Prévoyez un rendez-vous en journée par temps clair. Un vendeur qui ne propose qu'un essai en soirée ou par temps de pluie peut chercher à cacher des défauts visuels (rayures, retouches de peinture, traces de réparation). Refusez ce type de rendez-vous.",
        "Avant de partir, consultez la cote Argus et comparez avec au moins cinq annonces équivalentes. Ayez votre prix maximum en tête et tenez-vous-y. La négociation se prépare avant la visite, jamais sur le moment sous pression.",
      ],
    },
    {
      h2: "Inspection extérieure (10 points)",
      paragraphs: [
        "Point 1 : vérifier les alignements de carrosserie. Les écarts entre les portes et les ailes doivent être réguliers (environ 4 mm partout). Un écart anormal signale un choc et une remise en état approximative.",
        "Point 2 : peinture et reflets. Sous une lumière naturelle, vérifiez les reflets de la peinture en passant lentement autour de la voiture. Des nuances de couleur, des oranges peel marqués ou des bavures de masquage trahissent une retouche.",
        "Point 3 : vis et boulons. Sur les charnières de portes, de capot et de hayon, les vis d'origine ont une peinture intacte. Une vis qui présente des traces de clé ou un masquage signale qu'un élément a été démonté, donc probablement remplacé ou remis en état.",
        "Point 4 : test à l'aimant. Promenez un aimant fin sur les zones à risque (bas de portes, ailes arrière, passages de roues, hayon). Un aimant qui ne tient pas signale du mastic à la place de la tôle, donc une réparation après choc.",
        "Point 5 : pneumatiques. Vérifiez la profondeur de gomme avec une pièce de monnaie (insérez-la dans la rainure ; si l'inscription est visible entièrement, les pneus sont à remplacer). Vérifiez la date de fabrication sur le flanc (semaine + année, ex 2823 = semaine 28 de 2023). Vérifiez l'usure régulière (une usure asymétrique signale un problème de géométrie).",
        "Point 6 : phares et optiques. Allumez phares de croisement, phares de route, antibrouillards, clignotants, feux de stop. Vérifiez l'absence de buée à l'intérieur des optiques (signe d'étanchéité défaillante).",
        "Point 7 : pare-brise et vitres. Inspectez le pare-brise sous différents angles. Un éclat dans la zone du conducteur ou une fissure de plus de 30 cm impose un remplacement (200 à 800 € selon véhicule).",
        "Point 8 : carrosserie sous le véhicule. Avec votre lampe torche, regardez sous le véhicule. Recherchez des traces d'huile, de liquide de refroidissement, de liquide de frein. Une corrosion légère sur les bas de caisse est tolérable, une corrosion sur les longerons ou planchers est rédhibitoire.",
        "Point 9 : portes et hayon. Ouvrez et fermez chaque porte. Le mécanisme doit être fluide, la fermeture franche. Une porte qui claque trop fort ou ne se ferme pas du premier coup signale un défaut de réglage après un choc.",
        "Point 10 : capot et trappe à carburant. Ouvrez et fermez. Vérifiez la souplesse du mécanisme, l'absence de jeu anormal, l'intégrité de la trappe à carburant.",
      ],
    },
    {
      h2: "Inspection intérieure (8 points)",
      paragraphs: [
        "Point 11 : sellerie. Une voiture annoncée à 80 000 km avec un siège conducteur affaissé, une usure marquée sur le pourtour gauche ou des accoudoirs lustrés signale un kilométrage probablement trafiqué. L'usure doit être cohérente avec le kilométrage déclaré.",
        "Point 12 : volant, levier de vitesse, pédales. Tous trois s'usent visuellement. Un volant lisse au niveau des points de contact ou un caoutchouc de pédale poli signale un usage intensif. Idem pour la jante de levier de vitesse.",
        "Point 13 : tableau de bord et écrans. Allumez le contact sans démarrer. Tous les voyants doivent s'allumer puis s'éteindre dans les secondes suivantes. Un voyant moteur, ABS, ESP ou airbag persistant signale un défaut électronique ou mécanique.",
        "Point 14 : climatisation et chauffage. Allumez la climatisation puis le chauffage. La climatisation doit souffler de l'air froid en moins de deux minutes. Le chauffage doit monter en température en 5 à 10 minutes selon la saison. Une clim qui ne refroidit pas peut coûter 200 à 800 € à recharger ou réparer.",
        "Point 15 : système multimédia. Testez radio, Bluetooth, GPS si présents. Les premiers millésimes connectés (2014-2017) peuvent bugger. Une démonstration complète vous évite de découvrir le problème après l'achat.",
        "Point 16 : rétroviseurs et vitres électriques. Tous les rétroviseurs doivent se régler correctement et chauffer si la fonction est présente. Toutes les vitres doivent monter et descendre sans à-coup, des deux côtés.",
        "Point 17 : équipements de sécurité. Vérifiez la présence du gilet jaune, du triangle, du kit de secours (si la version le prévoit), de la roue de secours ou du kit anti-crevaison. Le manuel d'utilisation et l'entretien doivent également être présents.",
        "Point 18 : odeurs. Une odeur d'humidité ou de moisi dans l'habitacle signale une infiltration d'eau, fréquente sur les premiers SUV et certaines berlines. La réparation peut coûter de 500 à 2 500 € selon la source.",
      ],
    },
    {
      h2: "Inspection mécanique au démarrage (6 points)",
      paragraphs: [
        "Point 19 : démarrage à froid. C'est le point critique. Demandez au vendeur de ne pas démarrer la voiture avant votre arrivée. Touchez le capot avant de monter dans la voiture : il doit être tiède au plus, idéalement froid. Si le moteur est chaud, le vendeur dissimule un défaut au démarrage. Repartez sans signer.",
        "Point 20 : démarrage proprement dit. Le moteur doit démarrer en moins de deux secondes après actionnement du démarreur. Un démarrage long, hésitant ou nécessitant plusieurs tentatives signale un problème (batterie, injecteurs, démarreur, joint de culasse).",
        "Point 21 : bruit moteur les 30 premières secondes. Écoutez attentivement. Un cliquetis métallique, un sifflement aigu, un bruit de chaîne de distribution étirée, un claquement d'injecteur : autant de signaux d'alerte. Sur un moteur Prince (PSA 1.2 PureTech, BMW Mini), un bruit de pierres dans une bouteille signale une distribution en fin de vie.",
        "Point 22 : fumée d'échappement. Demandez à un assistant de tenir un mouchoir blanc à 10 cm du pot d'échappement pendant 30 secondes de ralenti. Le mouchoir doit rester propre. Des traces noires signalent une combustion mal réglée (essence trop riche ou diesel encrassé). Des traces grises ou bleues signalent une consommation d'huile, donc un problème mécanique grave.",
        "Point 23 : niveau d'huile sur la jauge. Sur la jauge, le niveau doit être entre le minimum et le maximum, idéalement aux 3/4. Un niveau bas signale soit une consommation excessive, soit un vendeur négligent. La couleur de l'huile doit être brun foncé sur diesel, jaune ambré sur essence. Une huile noire pâteuse signale un entretien insuffisant.",
        "Point 24 : niveau de liquide de refroidissement et de frein. Les bocaux doivent être propres et le niveau entre les repères. Un liquide de refroidissement brun, mousseux ou avec des dépôts signale un problème de joint de culasse. Un liquide de frein noir ou bas signale une révision en retard.",
      ],
    },
    {
      h2: "Essai routier (6 points)",
      paragraphs: [
        "Point 25 : démarrage et accélérations. Sur les premiers mètres, la voiture doit démarrer en douceur, sans à-coups, sans claquement de transmission. L'accélération doit être linéaire, sans baisses de régime ni saccades. Un point dur à l'accélération signale une fuite turbo, un capteur défaillant ou un encrassement.",
        "Point 26 : freinage à différentes vitesses. Sur une route dégagée, freinez fermement à 30, puis à 60, puis à 80 km/h. La voiture doit s'arrêter en ligne droite, sans tirer à droite ou à gauche, sans vibrations dans le volant. Tout déport ou vibration signale un problème de disques, plaquettes ou étriers.",
        "Point 27 : trajectoire et tenue de route. Sur autoroute ou voie rapide, lâchez brièvement le volant en ligne droite (seulement si la circulation est nulle). La voiture doit garder sa trajectoire sans dévier. Une dérive franche signale un problème de géométrie ou de pneumatiques.",
        "Point 28 : passage de vitesses. En manuel, chaque rapport doit s'enclencher sans accroc, l'embrayage doit mordre franchement. En automatique, les passages doivent être doux et imperceptibles à vitesse stabilisée. Des à-coups ou des passages lents signalent un problème de boîte (révision 1 500 à 3 000 €).",
        "Point 29 : essai en marche arrière et manœuvres. Effectuez plusieurs marches arrière, en braquant à fond à gauche puis à droite. Écoutez les bruits de roue : un claquement signale un joint de cardan en fin de vie (250 à 400 € par côté). Vérifiez le bon fonctionnement de la caméra de recul et des capteurs si présents.",
        "Point 30 : essai sur route bosselée. Trouvez un dos d'âne ou un chemin légèrement dégradé. Les suspensions doivent absorber les irrégularités sans bruits anormaux. Tout claquement signale des amortisseurs ou silent-blocs fatigués (200 à 600 € par train de suspensions).",
      ],
    },
    {
      h2: "Après l'essai : finaliser ou négocier",
      paragraphs: [
        "Après l'essai, prenez systématiquement du recul. Annoncez au vendeur que vous allez réfléchir et le recontacter dans la journée. Refusez toute pression à décider immédiatement.",
        "Synthétisez les défauts constatés. Pour chaque défaut tolérable, estimez le coût de réparation à partir d'un devis express en ligne ou par téléphone à un garagiste. Le total de ces coûts devient votre marge de négociation.",
        "Lors de la négociation, présentez la liste des points objectifs constatés (pas de jugement de valeur, juste les faits) et le coût de remise en état correspondant. Cette approche factuelle obtient généralement 5 à 15 % de baisse de prix sans difficulté.",
        "Si plus de cinq points majeurs sont défaillants, partez. La voiture est probablement mal entretenue dans son ensemble et présente un risque de pannes en cascade dans les six premiers mois.",
      ],
    },
  ],
  faq: [
    {
      q: "Combien de temps doit durer l'essai d'une voiture d'occasion ?",
      a: "Au minimum 30 minutes pour un essai complet : 10 minutes d'inspection statique, 5 minutes d'inspection mécanique au démarrage, 15 minutes d'essai routier sur parcours mixte (ville, route, autoroute si possible).",
    },
    {
      q: "Faut-il faire essayer la voiture par un garagiste ?",
      a: "Idéalement oui. Une inspection mécanique pré-achat coûte 150 à 300 € et permet de détecter des problèmes invisibles à l'œil. C'est l'investissement le plus rentable de l'achat. Le vendeur honnête accepte cette inspection sans difficulté.",
    },
    {
      q: "Que faire si le vendeur refuse l'essai routier ?",
      a: "Repartir immédiatement. Un vendeur honnête accepte l'essai sur présentation du permis et avec accompagnement. Le refus signale une voiture à problèmes (frein dangereux, défaut moteur visible en circulation) ou une arnaque.",
    },
    {
      q: "Quels documents demander pendant l'essai ?",
      a: "Carte grise au nom du vendeur, dernier contrôle technique (moins de 6 mois si véhicule de plus de 4 ans), carnet d'entretien complet, factures de révisions et réparations majeures, attestation d'assurance pour l'essai.",
    },
    {
      q: "Faut-il se méfier d'un moteur chaud au démarrage ?",
      a: "Oui systématiquement. Un vendeur qui démarre la voiture avant votre arrivée cherche à dissimuler un démarrage difficile à froid, qui signale toujours un problème mécanique (batterie, injecteurs, joint de culasse, fuites). Exigez un démarrage à froid.",
    },
    {
      q: "Comment vérifier la suspension d'une voiture d'occasion ?",
      a: "Appuyez fermement sur chaque coin de la voiture. La carrosserie doit revenir à sa position d'origine en une seule oscillation. Si elle rebondit deux ou trois fois, les amortisseurs sont fatigués. Essai obligatoire sur un dos d'âne ou un trottoir bas.",
    },
    {
      q: "Peut-on négocier après l'essai ?",
      a: "Oui, c'est même le bon moment. Listez les défauts objectifs constatés et leur coût de réparation. Présentez factuellement au vendeur en demandant un alignement de prix. 5 à 15 % de baisse sont généralement obtenables avec cette méthode.",
    },
  ],
};

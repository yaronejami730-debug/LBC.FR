/**
 * Référentiel « Bien-être & Beauté » — trois niveaux.
 *
 *   Catégorie  →  Sous-catégorie  →  Type d'annonce
 *   beaute-bien-etre → Massage → Massage californien
 *
 * Plus, sur des axes indépendants du type : nature de l'offre (prestation
 * vendue à un particulier / espace loué à un professionnel), format (privatif,
 * duo, à domicile), tarification, durée, capacité.
 *
 * Pourquoi séparer ces axes plutôt que multiplier les sous-catégories : une
 * « cabine de massage à louer 25 €/h » et un « massage relaxant 60 € » vivent
 * dans la même rubrique mais ne s'adressent pas au même public. Mélanger les
 * deux dans une liste de résultats rend la rubrique inutilisable — d'où
 * `offerKind` et `audience`, filtrables.
 *
 * Les motifs sont écrits en texte normalisé (minuscules, sans accents) : la
 * comparaison se fait sur le texte de l'annonce passé par `normalize()` de
 * ./classify. Ils couvrent les formulations réelles des vendeurs
 * (« pose américaine », « browlift », « cabine à louer »), pas seulement les
 * libellés officiels.
 */

export type WellnessType = {
  id: string;
  label: string;
  /** Formulations qui désignent ce type, normalisées. */
  patterns: string[];
};

export type WellnessSubcategory = {
  id: string;
  /** Libellé stocké sur l'annonce (doit exister dans lib/categories.ts). */
  label: string;
  emoji: string;
  /** Termes qui rattachent l'annonce à la sous-catégorie sans désigner de type. */
  keywords: string[];
  types: WellnessType[];
};

const t = (id: string, label: string, patterns: string[]): WellnessType => ({ id, label, patterns });

export const WELLNESS_SUBCATEGORIES: WellnessSubcategory[] = [
  {
    id: "massage",
    label: "Massage",
    emoji: "💆",
    keywords: ["massage", "masseur", "masseuse", "modelage", "massotherapie", "praticien massage"],
    types: [
      t("massage_relaxant", "Massage relaxant", ["massage relaxant", "massage detente", "massage bien etre", "massage de relaxation", "dispo pour massage relaxant"]),
      t("massage_sportif", "Massage sportif", ["massage sportif", "massage decontractant", "massage recuperation", "massage apres sport", "massage deep tissue"]),
      t("massage_dos", "Massage du dos", ["massage du dos", "massage dos", "massage dos nuque epaules", "massage nuque"]),
      t("massage_cranien", "Massage crânien", ["massage cranien", "massage du crane", "massage tete", "massage indien de la tete"]),
      t("massage_californien", "Massage californien", ["massage californien", "californien"]),
      t("massage_suedois", "Massage suédois", ["massage suedois", "suedois"]),
      t("massage_thai", "Massage thaï", ["massage thai", "massage thailandais", "thai traditionnel"]),
      t("massage_balinais", "Massage balinais", ["massage balinais", "balinais"]),
      t("massage_ayurvedique", "Massage ayurvédique", ["massage ayurvedique", "ayurvedique", "abhyanga"]),
      t("massage_pierres", "Massage aux pierres chaudes", ["pierres chaudes", "massage aux pierres", "hot stone"]),
      t("massage_prenatal", "Massage prénatal", ["massage prenatal", "massage femme enceinte", "massage grossesse"]),
      t("massage_duo", "Massage duo", ["massage duo", "massage en duo", "massage a deux", "massage en couple"]),
      t("massage_domicile", "Massage à domicile", ["massage a domicile", "masseuse a domicile", "masseur a domicile", "massage chez vous"]),
      t("massage_institut", "Massage en institut", ["massage en institut", "massage en cabine", "massage au salon"]),
      t("massage_assis", "Massage assis", ["massage assis", "massage amma", "amma assis", "massage sur chaise"]),
      t("reflexologie", "Réflexologie", ["reflexologie", "reflexologie plantaire", "reflexo"]),
      t("drainage", "Drainage lymphatique", ["drainage lymphatique", "drainage", "palper rouler", "pressotherapie"]),
      t("modelage_corps", "Modelage corps", ["modelage corps", "modelage du corps", "modelage complet"]),
      t("massage_jambes", "Massage jambes", ["massage jambes", "jambes legeres", "massage jambes lourdes"]),
      t("massage_visage", "Massage visage", ["massage visage", "modelage visage", "kobido"]),
      t("massage_pieds", "Massage pieds", ["massage des pieds", "massage pieds"]),
    ],
  },
  {
    id: "onglerie",
    label: "Onglerie",
    emoji: "💅",
    keywords: ["onglerie", "ongles", "prothesiste ongulaire", "nail", "nail bar", "ongulaire"],
    types: [
      t("manucure", "Manucure", ["manucure", "manicure", "soin des ongles"]),
      t("beaute_mains", "Beauté des mains", ["beaute des mains", "soin des mains"]),
      t("beaute_pieds", "Beauté des pieds", ["beaute des pieds", "soin des pieds"]),
      t("pose_vernis", "Pose de vernis", ["pose de vernis", "pose vernis", "vernis classique"]),
      t("semi_permanent", "Vernis semi-permanent", ["semi permanent", "semi-permanent", "vernis permanent", "sp ongles"]),
      t("gel", "Gel", ["pose gel", "ongles en gel", "gel uv", "pose de gel", "modele pour pose gel", "remplissage gel"]),
      t("resine", "Résine", ["resine", "pose resine", "ongles en resine"]),
      t("acrygel", "Acrygel", ["acrygel", "acryl gel", "polygel"]),
      t("capsules", "Capsules", ["capsules", "pose capsules", "pose americaine"]),
      t("nail_art", "Nail art", ["nail art", "deco ongles", "decoration ongles", "chrome ongles"]),
      t("french", "French", ["french", "french manucure", "babyboomer", "baby boomer"]),
      t("remplissage", "Remplissage", ["remplissage", "retouche ongles"]),
      t("depose", "Dépose", ["depose", "depose ongles", "retrait gel"]),
      t("reparation_ongle", "Réparation d'ongle", ["reparation ongle", "reparation d ongle"]),
      t("extension_ongles", "Extension d'ongles", ["extension ongles", "extensions d ongles", "rallongement ongles"]),
      t("pedicure_esthetique", "Pédicure esthétique", ["pedicure esthetique", "pedicure"]),
    ],
  },
  {
    id: "sourcils-cils",
    label: "Sourcils & cils",
    emoji: "👁️",
    keywords: ["sourcils", "cils", "regard", "lash", "brow"],
    types: [
      t("epilation_sourcils", "Épilation sourcils", ["epilation sourcils", "epilation des sourcils"]),
      t("restructuration_sourcils", "Restructuration sourcils", ["restructuration sourcils", "restructuration des sourcils", "architecte du regard"]),
      t("brow_lift", "Brow lift", ["brow lift", "browlift", "rehaussement sourcils"]),
      t("teinture_sourcils", "Teinture sourcils", ["teinture sourcils", "henne sourcils", "coloration sourcils"]),
      t("microblading", "Microblading", ["microblading", "micro blading"]),
      t("microshading", "Microshading", ["microshading", "micro shading", "powder brows", "ombre brows"]),
      t("maquillage_permanent_sourcils", "Maquillage permanent sourcils", ["maquillage permanent", "dermopigmentation", "micropigmentation"]),
      t("extension_cils", "Extension de cils", ["extension de cils", "extensions de cils", "pose de cils", "volume russe", "cil a cil"]),
      t("rehaussement_cils", "Rehaussement de cils", ["rehaussement de cils", "rehaussement cils"]),
      t("teinture_cils", "Teinture cils", ["teinture cils", "teinture des cils"]),
      t("lash_lift", "Lash lift", ["lash lift", "lashlift"]),
    ],
  },
  {
    id: "maquillage",
    label: "Maquillage",
    emoji: "💄",
    keywords: ["maquillage", "make up", "makeup", "maquilleuse", "mua", "mise en beaute"],
    types: [
      t("maquillage_classique", "Maquillage classique", ["maquillage classique", "maquillage jour", "maquillage naturel"]),
      t("maquillage_soiree", "Maquillage soirée", ["maquillage soiree", "make up soiree", "maquillage glamour"]),
      t("maquillage_mariage", "Maquillage mariage", ["maquillage mariage", "maquillage mariee", "make up mariee"]),
      t("maquillage_evenementiel", "Maquillage événementiel", ["maquillage evenementiel", "maquillage shooting", "maquillage photo"]),
      t("maquillage_artistique", "Maquillage artistique", ["maquillage artistique", "body painting", "maquillage enfant", "maquillage halloween"]),
      t("maquillage_professionnel", "Maquillage professionnel", ["maquillage professionnel", "maquilleuse professionnelle"]),
      t("cours_maquillage", "Cours de maquillage", ["cours de maquillage", "atelier maquillage", "self make up"]),
      t("maquillage_domicile", "Maquillage à domicile", ["maquillage a domicile", "maquilleuse a domicile"]),
    ],
  },
  {
    id: "soins-visage",
    label: "Soins du visage",
    emoji: "🧖",
    keywords: ["soin du visage", "soins visage", "esthetique", "esitheticienne", "estheticienne", "institut de beaute", "soin visage"],
    types: [
      t("nettoyage_peau", "Nettoyage de peau", ["nettoyage de peau", "nettoyage de peau profond", "soin visage profond", "extraction comedons"]),
      t("soin_hydratant", "Soin hydratant", ["soin hydratant", "hydratation visage"]),
      t("soin_anti_age", "Soin anti-âge", ["soin anti age", "anti age", "anti rides", "lifting visage"]),
      t("soin_purifiant", "Soin purifiant", ["soin purifiant", "peau grasse", "anti imperfections", "soin acne"]),
      t("soin_eclat", "Soin éclat", ["soin eclat", "coup d eclat", "glow facial"]),
      t("soin_peau_sensible", "Soin peau sensible", ["peau sensible", "soin apaisant", "peau reactive"]),
      t("peeling", "Peeling", ["peeling", "peeling doux", "peeling chimique"]),
      t("microdermabrasion", "Microdermabrasion", ["microdermabrasion", "dermabrasion"]),
      t("hydrafacial", "Hydrafacial", ["hydrafacial", "hydra facial", "hydro facial"]),
      t("microneedling", "Microneedling", ["microneedling", "micro needling", "dermapen"]),
      t("masque_visage", "Masque visage", ["masque visage", "masque hydratant"]),
      t("contour_yeux", "Soin contour des yeux", ["contour des yeux", "soin yeux", "poches et cernes"]),
      t("soin_homme", "Soin du visage homme", ["soin visage homme", "soin homme", "facial homme"]),
    ],
  },
  {
    id: "epilation",
    label: "Épilation",
    emoji: "🧴",
    keywords: ["epilation", "cire", "epil", "lumiere pulsee", "laser"],
    types: [
      t("epilation_visage", "Épilation visage", ["epilation visage", "epilation du visage"]),
      t("epilation_sourcils_ep", "Épilation sourcils", ["epilation sourcils"]),
      t("epilation_levre", "Épilation lèvre", ["epilation levre", "levre superieure", "duvet levre"]),
      t("epilation_menton", "Épilation menton", ["epilation menton"]),
      t("epilation_jambes", "Épilation jambes", ["epilation jambes", "demi jambes", "jambes completes"]),
      t("epilation_bras", "Épilation bras", ["epilation bras", "epilation avant bras"]),
      t("epilation_aisselles", "Épilation aisselles", ["epilation aisselles", "aisselles"]),
      t("epilation_maillot", "Épilation maillot", ["epilation maillot", "maillot classique", "maillot echancre", "maillot bresilien"]),
      t("epilation_integrale", "Épilation intégrale", ["epilation integrale", "integrale corps", "epilation complete"]),
      t("epilation_homme", "Épilation homme", ["epilation homme", "epilation torse", "epilation dos homme"]),
      t("epilation_cire", "Épilation cire", ["epilation a la cire", "cire chaude", "cire tiede", "epilation orientale", "fil oriental"]),
      t("epilation_laser", "Épilation définitive / laser", ["epilation laser", "epilation definitive", "laser diode"]),
      t("lumiere_pulsee", "Lumière pulsée", ["lumiere pulsee", "ipl", "flash epilation"]),
    ],
  },
  {
    id: "coiffure",
    label: "Coiffure",
    emoji: "💇",
    keywords: ["coiffure", "coiffeur", "coiffeuse", "salon de coiffure", "barbier", "barber", "barbershop", "cheveux"],
    types: [
      t("coupe_femme", "Coupe femme", ["coupe femme", "coupe dame"]),
      t("coupe_homme", "Coupe homme", ["coupe homme", "degrade americain", "fade"]),
      t("coupe_enfant", "Coupe enfant", ["coupe enfant", "coupe garcon", "coupe fille"]),
      t("brushing", "Brushing", ["brushing", "wavy", "bouclage"]),
      t("coloration", "Coloration", ["coloration", "couleur cheveux", "coloration vegetale"]),
      t("meches", "Mèches", ["meches", "meche"]),
      t("balayage", "Balayage", ["balayage", "babylights"]),
      t("ombre_hair", "Ombré hair", ["ombre hair", "tie and dye", "sombre hair"]),
      t("decoloration", "Décoloration", ["decoloration", "blond polaire"]),
      t("lissage", "Lissage", ["lissage", "lissage tanin"]),
      t("lissage_bresilien", "Lissage brésilien", ["lissage bresilien", "keratine"]),
      t("lissage_japonais", "Lissage japonais", ["lissage japonais"]),
      t("permanente", "Permanente", ["permanente", "boucles permanentes"]),
      t("extensions", "Extensions", ["extensions capillaires", "extension cheveux", "tissage", "pose de meches"]),
      t("coiffure_evenementielle", "Coiffure événementielle", ["coiffure evenementielle", "chignon", "coiffure soiree"]),
      t("coiffure_mariage", "Coiffure mariage", ["coiffure mariage", "chignon mariee", "coiffure mariee"]),
      t("coiffure_afro", "Coiffure afro", ["coiffure afro", "cheveux crepus", "defrisage", "twist out"]),
      t("tresses", "Tresses", ["tresses", "braids", "box braids", "nattes", "vanilles"]),
      t("locks", "Locks", ["locks", "dreadlocks", "dreads", "reprise de racines locks"]),
      t("barber", "Barber", ["barber", "barbier", "barbershop", "barber a domicile"]),
      t("taille_barbe", "Taille de barbe", ["taille de barbe", "contour de barbe", "entretien barbe"]),
      t("rasage", "Rasage", ["rasage", "coupe chou", "rasage traditionnel"]),
    ],
  },
  {
    id: "spa-detente",
    label: "Spa & détente",
    emoji: "🧖‍♀️",
    keywords: ["spa", "hammam", "sauna", "jacuzzi", "detente", "balneo", "bien etre"],
    types: [
      t("spa_privatif", "Spa privatif", ["spa privatif", "privatisation spa", "spa prive"]),
      t("jacuzzi", "Jacuzzi", ["jacuzzi", "bain a remous", "spa gonflable"]),
      t("sauna", "Sauna", ["sauna", "sauna finlandais", "sauna infrarouge"]),
      t("hammam", "Hammam", ["hammam", "bain maure", "rituel hammam", "gommage savon noir"]),
      t("hammam_privatif", "Hammam privatif", ["hammam privatif", "privatisation hammam", "hammam prive"]),
      t("bain", "Bain", ["bain nordique", "bain japonais", "bain relaxant", "bain de vapeur"]),
      t("balneotherapie", "Balnéothérapie", ["balneotherapie", "balneo", "thalasso", "thalassotherapie"]),
      t("espace_detente", "Espace détente", ["espace detente", "espace bien etre", "moment detente"]),
      t("salle_relaxation", "Salle de relaxation", ["salle de relaxation", "salle de repos"]),
      t("spa_duo", "Spa duo", ["spa duo", "spa a deux", "hammam duo", "moment detente en amoureux", "en amoureux"]),
      t("spa_groupe", "Spa groupe", ["spa groupe", "spa entre amis", "hammam groupe", "evjf spa"]),
      t("spa_romantique", "Spa romantique", ["spa romantique", "escapade romantique"]),
      t("spa_journee", "Spa à la journée", ["spa a la journee", "day spa", "journee spa"]),
      t("spa_heure", "Spa à l'heure", ["spa a l heure", "sauna a la seance", "hammam a l heure"]),
    ],
  },
  {
    id: "location-espace",
    label: "Location d'espace bien-être",
    emoji: "🏢",
    keywords: [
      "location cabine", "cabine a louer", "cabine disponible", "local esthetique", "institut a louer",
      "espace beaute partage", "salon a louer", "fauteuil a louer", "poste a louer", "sous location",
    ],
    types: [
      t("location_cabine", "Location cabine", ["location cabine", "cabine a louer", "cabine disponible", "cabine de soin"]),
      t("location_cabine_massage", "Location cabine massage", ["cabine de massage", "cabine massage a louer", "location cabine massage"]),
      t("location_cabine_esthetique", "Location cabine esthétique", ["cabine esthetique", "cabine esthetique disponible", "local esthetique"]),
      t("location_salle_massage", "Location salle de massage", ["salle de massage", "location salle de massage", "salle de soin"]),
      t("location_salon_coiffure", "Location salon de coiffure", ["salon de coiffure a louer", "location salon de coiffure", "fauteuil coiffure a louer", "fauteuil de coiffure"]),
      t("location_espace_onglerie", "Location espace onglerie", ["espace onglerie", "poste onglerie", "table onglerie a louer"]),
      t("location_hammam", "Location hammam", ["location hammam", "hammam a louer"]),
      t("location_sauna", "Location sauna", ["location sauna", "sauna a louer"]),
      t("location_spa", "Location spa", ["location spa", "spa a louer"]),
      t("location_jacuzzi", "Location jacuzzi", ["location jacuzzi", "jacuzzi a louer"]),
      t("location_espace_privatif", "Location espace privatif", ["espace privatif a louer", "location espace privatif", "espace beaute partage", "institut a louer"]),
    ],
  },
  {
    id: "sport-recuperation",
    label: "Sport & récupération",
    emoji: "🏋️",
    keywords: ["recuperation", "coach sportif", "kine", "osteo", "physio", "cryotherapie"],
    types: [
      t("massage_sportif_sr", "Massage sportif", ["massage sportif", "massage decontractant sportif"]),
      t("recuperation_musculaire", "Récupération musculaire", ["recuperation musculaire", "recuperation apres sport", "courbatures"]),
      t("etirements", "Étirements", ["etirements", "stretching", "assouplissement"]),
      t("coaching_sportif", "Coaching sportif", ["coach sportif", "coaching sportif", "personal trainer"]),
      t("preparation_physique", "Préparation physique", ["preparation physique", "prepa physique"]),
      t("kinesitherapie", "Kinésithérapie", ["kinesitherapie", "kine", "kinesitherapeute"]),
      t("osteopathie", "Ostéopathie", ["osteopathie", "osteopathe", "osteo"]),
      t("physiotherapie", "Physiothérapie", ["physiotherapie", "physiotherapeute"]),
      t("cryotherapie", "Cryothérapie", ["cryotherapie", "cryo", "bain froid"]),
      t("pressotherapie", "Pressothérapie", ["pressotherapie", "bottes de compression"]),
    ],
  },
  {
    id: "relaxation",
    label: "Relaxation & bien-être",
    emoji: "🧘",
    keywords: ["relaxation", "bien etre", "atelier bien etre", "energetique"],
    types: [
      t("yoga", "Yoga", ["yoga", "hatha yoga", "vinyasa", "yin yoga"]),
      t("meditation", "Méditation", ["meditation", "pleine conscience", "mindfulness"]),
      t("sophrologie", "Sophrologie", ["sophrologie", "sophrologue"]),
      t("relaxation_seance", "Relaxation", ["seance de relaxation", "relaxation profonde"]),
      t("respiration", "Respiration", ["coherence cardiaque", "exercices de respiration", "breathwork"]),
      t("pilates", "Pilates", ["pilates", "reformer"]),
      t("reiki", "Reiki", ["reiki", "magnetisme", "soin energetique"]),
      t("reflexologie_relax", "Réflexologie", ["reflexologie palmaire", "reflexologie faciale"]),
      t("developpement_personnel", "Développement personnel", ["developpement personnel", "hypnose", "coaching de vie"]),
      t("ateliers", "Ateliers bien-être", ["atelier bien etre", "stage bien etre", "retraite bien etre"]),
    ],
  },
];

/** Libellés de sous-catégories — doivent rester alignés sur lib/categories.ts. */
export const WELLNESS_SUBCATEGORY_LABELS = WELLNESS_SUBCATEGORIES.map((s) => s.label);

/**
 * Nature de l'offre. Le tri par défaut d'une rubrique grand public doit pouvoir
 * écarter les annonces entre professionnels.
 */
export type OfferKind = "prestation" | "location_espace" | "recherche_modele" | "vente_produit";

export const OFFER_KIND_LABELS: Record<OfferKind, string> = {
  prestation: "Prestation",
  location_espace: "Location professionnelle",
  recherche_modele: "Recherche de modèle",
  vente_produit: "Vente de matériel",
};

/** Location d'un espace / poste de travail — annonce entre professionnels. */
export const RENTAL_PATTERNS = [
  "a louer", "en location", "location ", "sous location", "sous-location",
  "disponible a la location", "loue ", "je loue", "mise a disposition",
  "privatisation", "a la location",
];

/** Recherche de modèle : ni vente ni location, souvent gratuit ou à prix réduit. */
export const MODEL_SEARCH_PATTERNS = [
  "cherche modele", "recherche modele", "modele pour", "recherche modeles",
  "cherche modeles", "besoin de modeles", "en formation cherche",
];

/** Vente de matériel : la rubrique n'est pas une place de marché d'équipement. */
export const PRODUCT_SALE_PATTERNS = [
  "vends", "a vendre", "je vends", "table de massage", "fauteuil de massage",
  "appareil de", "lampe uv", "ponceuse ongles", "stock de", "lot de", "neuf jamais servi",
];

/** Formats — cumulables. */
export const FORMAT_PATTERNS: { id: string; label: string; patterns: string[] }[] = [
  { id: "privatif", label: "Privatif", patterns: ["privatif", "privatisation", "prive", "privatise"] },
  { id: "duo", label: "Duo", patterns: ["duo", "a deux", "en couple", "en amoureux", "2 personnes"] },
  { id: "groupe", label: "Groupe", patterns: ["groupe", "entre amis", "evjf", "evg", "team building"] },
  { id: "domicile", label: "À domicile", patterns: ["a domicile", "chez vous", "je me deplace", "mobile"] },
  { id: "institut", label: "En institut", patterns: ["en institut", "en salon", "en cabine", "sur place", "au salon"] },
];

/** Public visé — déduit de l'offre, pas déclaré par le vendeur. */
export type Audience = "particulier" | "professionnel";

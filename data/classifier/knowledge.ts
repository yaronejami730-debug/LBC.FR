/**
 * Base de connaissance de la catégorisation.
 *
 * Ce fichier n'est **pas** le moteur, et n'est pas chargé par le navigateur :
 * c'est la source de savoir à partir de laquelle un script génère le jeu
 * d'exemples puis l'index compact utilisé à l'exécution.
 *
 * Trois natures de termes, et la distinction est tout l'enjeu :
 *
 *  - `heads` — le nom de la chose vendue. « canapé », « iphone »,
 *    « appartement ». C'est ce qui rend un nœud candidat.
 *  - `mods` — ce qui qualifie et parfois *déplace* la catégorie. « bébé »
 *    dans « lit bébé » ne décrit pas un lit, il change de rayon.
 *  - `brands` / `models` — preuves fortes quand elles sont non ambiguës.
 *
 * Les mots génériques du commerce (« urgent », « bon état ») sont listés à
 * part : ils n'ont jamais valeur de catégorie, et les compter comme les autres
 * était l'une des causes du bruit constaté à l'audit.
 */

export type NodeKnowledge = {
  /** Noms-têtes : ce que l'annonce vend. */
  heads: string[];
  /** Qualificatifs contextuels, éventuellement déplaçants. */
  mods?: string[];
  brands?: string[];
  models?: string[];
};

/** Clé = `categoryId/subcategoryId` de `lib/category/taxonomy.ts`. */
export const KNOWLEDGE: Record<string, NodeKnowledge> = {
  // ── Immobilier ───────────────────────────────────────────────────────────
  "immobilier/ventes-immobilieres": {
    heads: ["appartement", "maison", "villa", "studio", "duplex", "loft", "terrain", "immeuble", "propriété", "pavillon", "ferme", "château", "chalet"],
    mods: ["vente", "à vendre", "t1", "t2", "t3", "t4", "t5", "f2", "f3", "f4", "pièces", "m2", "acheter", "notaire", "viager"],
  },
  "immobilier/locations": {
    heads: ["appartement", "studio", "maison", "chambre", "logement", "t2", "t3"],
    mods: ["location", "à louer", "loyer", "meublé", "non meublé", "bail", "charges comprises", "cc", "hc", "locataire"],
  },
  "immobilier/colocations": {
    heads: ["colocation", "coloc", "chambre"],
    mods: ["colocataire", "coloc", "partager", "appartement partagé", "coliving"],
  },
  "immobilier/bureaux-et-commerces": {
    heads: ["bureau", "local commercial", "entrepôt", "commerce", "boutique", "fonds de commerce", "hangar", "atelier"],
    mods: ["professionnel", "bail commercial", "pas de porte", "droit au bail"],
  },
  "immobilier/locations-de-vacances": {
    heads: ["gîte", "villa", "mobil-home", "chalet", "bungalow"],
    mods: ["vacances", "saisonnier", "semaine", "week-end", "bord de mer", "piscine", "airbnb"],
  },

  // ── Véhicules ────────────────────────────────────────────────────────────
  "vehicules/voitures": {
    heads: ["voiture", "auto", "automobile", "berline", "citadine", "suv", "break", "cabriolet", "monospace", "4x4", "coupé"],
    mods: ["essence", "diesel", "hybride", "électrique", "boîte auto", "automatique", "manuelle", "cv", "km", "première main", "ct ok", "carte grise"],
    brands: ["peugeot", "renault", "citroën", "volkswagen", "bmw", "audi", "mercedes", "toyota", "ford", "opel", "fiat", "nissan", "dacia", "seat", "skoda", "hyundai", "kia", "volvo", "mini", "tesla", "porsche", "jaguar", "land rover", "mazda", "honda", "suzuki", "alfa romeo", "lexus", "jeep", "smart"],
    models: ["208", "308", "3008", "5008", "2008", "clio", "megane", "captur", "kadjar", "twingo", "scenic", "c3", "c4", "picasso", "golf", "polo", "passat", "tiguan", "série 1", "série 3", "série 5", "x1", "x3", "x5", "a1", "a3", "a4", "a6", "q3", "q5", "classe a", "classe c", "classe e", "yaris", "corolla", "rav4", "fiesta", "focus", "kuga", "corsa", "astra", "500", "punto", "sandero", "duster", "logan", "ibiza", "leon", "octavia", "model 3", "model y", "zoe"],
  },
  "vehicules/motos": {
    heads: ["moto", "scooter", "mobylette", "cyclomoteur", "quad", "motocross", "roadster", "trail", "custom", "50cc", "125"],
    mods: ["cm3", "permis a", "casque", "cylindrée"],
    brands: ["yamaha", "honda", "kawasaki", "suzuki", "ducati", "harley", "ktm", "piaggio", "vespa", "peugeot kisbee", "mbk", "triumph", "aprilia"],
    models: ["mt07", "mt09", "z650", "z900", "cbr", "gsxr", "r1", "r6", "tmax", "xmax", "pcx", "sh125"],
  },
  "vehicules/caravaning": {
    heads: ["camping-car", "caravane", "fourgon aménagé", "van aménagé", "mobil-home", "remorque"],
    mods: ["capucine", "profilé", "intégral", "auvent", "couchage"],
    brands: ["hymer", "adria", "chausson", "bürstner", "rapido", "challenger", "eriba"],
  },
  "vehicules/utilitaires": {
    heads: ["utilitaire", "fourgon", "camion", "camionnette", "benne", "plateau", "tracteur routier", "poids lourd"],
    mods: ["m3", "double cabine", "hayon", "société"],
    brands: ["kangoo", "berlingo", "partner", "trafic", "jumpy", "expert", "master", "ducato", "transit", "sprinter", "boxer", "jumper", "crafter"],
  },
  "vehicules/equipements-auto": {
    heads: ["pneu", "jante", "attelage", "coffre de toit", "barres de toit", "batterie", "autoradio", "gps", "siège auto", "chaînes neige", "pare-chocs", "rétroviseur", "amortisseur", "plaquettes"],
    mods: ["hiver", "été", "4 saisons", "pouces", "occasion"],
    brands: ["michelin", "continental", "bridgestone", "goodyear", "thule", "bosch", "pioneer"],
  },

  // ── Maison ───────────────────────────────────────────────────────────────
  "maison/ameublement": {
    heads: ["canapé", "canape", "fauteuil", "table", "chaise", "lit", "armoire", "commode", "buffet", "bureau", "étagère", "bibliothèque", "meuble tv", "tabouret", "matelas", "sommier", "dressing", "banquette", "table basse", "table à manger"],
    mods: ["convertible", "angle", "places", "cuir", "tissu", "chêne", "massif", "scandinave", "vintage", "ikea"],
    brands: ["ikea", "maisons du monde", "conforama", "but", "roche bobois", "habitat"],
  },
  "maison/electromenager": {
    heads: ["réfrigérateur", "frigo", "congélateur", "lave-linge", "machine à laver", "sèche-linge", "lave-vaisselle", "four", "micro-ondes", "plaque induction", "hotte", "aspirateur", "robot cuiseur", "cafetière", "friteuse", "grille-pain", "mixeur", "blender", "centrifugeuse"],
    mods: ["encastrable", "combiné", "litres", "classe a", "kg"],
    brands: ["bosch", "samsung", "lg", "whirlpool", "electrolux", "siemens", "beko", "brandt", "moulinex", "seb", "thermomix", "dyson", "delonghi", "nespresso", "philips"],
  },
  "maison/arts-de-la-table": {
    heads: ["assiette", "verre", "couvert", "service de table", "vaisselle", "casserole", "poêle", "cocotte", "faitout", "carafe", "ménagère", "plat", "saladier", "théière"],
    mods: ["porcelaine", "inox", "fonte", "cristal", "pièces"],
    brands: ["le creuset", "tefal", "villeroy", "luminarc", "arcopal", "duralex"],
  },
  "maison/decoration": {
    heads: ["tableau", "cadre", "miroir", "vase", "lampe", "luminaire", "lustre", "tapis", "horloge", "bougeoir", "statue", "sculpture", "applique", "guirlande"],
    mods: ["mural", "design", "déco", "ambiance"],
  },
  "maison/linge-de-maison": {
    heads: ["couette", "housse de couette", "drap", "oreiller", "coussin", "plaid", "rideau", "serviette", "nappe", "parure de lit", "couverture", "traversin"],
    mods: ["coton", "lin", "percale", "personnes", "cm"],
  },
  "maison/bricolage": {
    heads: ["perceuse", "visseuse", "scie", "meuleuse", "ponceuse", "marteau", "échelle", "escabeau", "établi", "compresseur", "clé à choc", "niveau laser", "boîte à outils", "tournevis", "chalumeau", "bétonnière"],
    mods: ["sans fil", "watts", "volts", "professionnel"],
    brands: ["bosch", "makita", "dewalt", "ryobi", "parkside", "stanley", "facom", "milwaukee", "black et decker"],
  },
  "maison/jardinage": {
    heads: ["tondeuse", "taille-haie", "débroussailleuse", "tronçonneuse", "salon de jardin", "barbecue", "plancha", "serre", "abri de jardin", "arrosage", "motoculteur", "souffleur", "brouette", "piscine", "parasol", "transat"],
    mods: ["thermique", "électrique", "gazon", "jardin", "extérieur", "plantes"],
    brands: ["husqvarna", "stihl", "gardena", "weber", "honda", "einhell"],
  },

  // ── Multimédia ───────────────────────────────────────────────────────────
  "multimedia/informatique": {
    heads: ["ordinateur", "pc", "laptop", "macbook", "imac", "portable", "tour", "écran", "moniteur", "clavier", "souris", "imprimante", "disque dur", "ssd", "carte graphique", "processeur", "ram", "tablette", "ipad", "chromebook", "serveur", "nas"],
    mods: ["gaming", "gamer", "bureautique", "pouces", "go", "to", "i5", "i7", "i9", "ryzen", "m1", "m2", "m3", "ddr4", "windows", "macos"],
    brands: ["apple", "dell", "hp", "lenovo", "asus", "acer", "msi", "samsung", "microsoft", "logitech", "razer", "corsair", "nvidia", "amd", "intel", "epson", "canon", "brother"],
    models: ["macbook air", "macbook pro", "surface", "thinkpad", "xps", "pavilion", "rtx 3060", "rtx 4070", "ipad air", "ipad pro"],
  },
  "multimedia/consoles-et-jeux-video": {
    heads: ["console", "playstation", "ps4", "ps5", "xbox", "nintendo", "switch", "manette", "jeu vidéo", "jeux vidéo", "game boy", "megadrive", "casque vr", "steam deck"],
    mods: ["series x", "series s", "slim", "pro", "oled", "édition limitée", "fifa", "call of duty", "zelda", "mario", "gta"],
    brands: ["sony", "microsoft", "nintendo", "sega", "valve", "oculus", "meta quest"],
  },
  "multimedia/image-et-son": {
    heads: ["télévision", "tv", "téléviseur", "vidéoprojecteur", "home cinéma", "barre de son", "enceinte", "casque audio", "écouteurs", "ampli", "platine", "appareil photo", "caméra", "objectif", "drone", "chaîne hifi", "subwoofer"],
    mods: ["pouces", "4k", "oled", "qled", "bluetooth", "sans fil", "réflex", "hybride", "reflex"],
    brands: ["samsung", "lg", "sony", "philips", "bose", "jbl", "sonos", "marshall", "canon", "nikon", "gopro", "dji", "yamaha", "denon", "beats", "airpods"],
  },
  "multimedia/telephonie": {
    heads: ["téléphone", "smartphone", "iphone", "portable", "mobile", "coque", "chargeur", "montre connectée", "smartwatch", "écouteurs sans fil"],
    mods: ["go", "débloqué", "tout opérateur", "double sim", "5g", "état neuf", "batterie"],
    brands: ["apple", "samsung", "xiaomi", "huawei", "oppo", "google", "oneplus", "sony", "nokia", "honor", "realme", "motorola"],
    models: ["iphone 11", "iphone 12", "iphone 13", "iphone 14", "iphone 15", "iphone 16", "galaxy s21", "galaxy s22", "galaxy s23", "galaxy s24", "redmi", "pixel 7", "pixel 8", "apple watch"],
  },

  // ── Mode ─────────────────────────────────────────────────────────────────
  "mode/vetements": {
    heads: ["robe", "pantalon", "jean", "veste", "manteau", "blouson", "pull", "chemise", "t-shirt", "tee-shirt", "sweat", "jupe", "short", "costume", "combinaison", "doudoune", "gilet", "survêtement", "maillot de bain", "blazer"],
    mods: ["taille", "femme", "homme", "s", "m", "l", "xl", "xxl", "38", "40", "42", "coton", "cuir", "laine"],
    brands: ["zara", "h&m", "nike", "adidas", "levis", "lacoste", "the kooples", "sandro", "maje", "uniqlo", "mango", "bershka", "ralph lauren", "tommy hilfiger", "north face", "sezane"],
  },
  "mode/chaussures": {
    heads: ["chaussure", "basket", "sneaker", "botte", "bottine", "escarpin", "sandale", "mocassin", "derbies", "ballerine", "tong", "chausson", "running"],
    mods: ["pointure", "taille", "cuir", "homme", "femme", "enfant", "37", "38", "39", "40", "41", "42", "43", "44"],
    brands: ["nike", "adidas", "puma", "new balance", "converse", "vans", "asics", "timberland", "dr martens", "ugg", "birkenstock", "salomon", "jordan"],
    models: ["air max", "air force", "stan smith", "gazelle", "chuck taylor", "990", "superstar", "yeezy"],
  },
  "mode/accessoires-et-bagagerie": {
    heads: ["sac", "sac à main", "valise", "bagage", "portefeuille", "ceinture", "écharpe", "casquette", "bonnet", "lunettes de soleil", "cartable", "sacoche", "porte-monnaie", "cabas", "sac à dos"],
    mods: ["cuir", "vintage", "cabine", "roulettes", "litres"],
    brands: ["louis vuitton", "gucci", "chanel", "longchamp", "michael kors", "samsonite", "eastpak", "herschel", "ray-ban", "hermès", "dior", "prada"],
  },
  "mode/montres-et-bijoux": {
    heads: ["montre", "bracelet", "collier", "bague", "boucles d'oreilles", "chaîne", "pendentif", "alliance", "gourmette", "chevalière", "broche"],
    mods: ["or", "argent", "plaqué or", "diamant", "automatique", "quartz", "carats"],
    brands: ["rolex", "omega", "seiko", "casio", "tissot", "festina", "swarovski", "pandora", "cartier", "breitling", "tag heuer", "fossil", "ice watch"],
    models: ["submariner", "daytona", "speedmaster", "seamaster", "g-shock"],
  },

  // ── Loisirs ──────────────────────────────────────────────────────────────
  "loisirs/dvd-films": {
    heads: ["dvd", "blu-ray", "film", "coffret dvd", "série dvd", "vhs"],
    mods: ["intégrale", "saison", "collector", "édition"],
  },
  "loisirs/livres": {
    heads: ["livre", "roman", "bd", "bande dessinée", "manga", "encyclopédie", "dictionnaire", "magazine", "revue", "poche", "beau livre"],
    mods: ["tome", "collection", "édition", "broché", "relié"],
    brands: ["gallimard", "hachette", "glénat", "dargaud", "delcourt"],
  },
  "loisirs/musique-instruments": {
    heads: ["guitare", "piano", "batterie", "violon", "saxophone", "trompette", "flûte", "synthétiseur", "clavier", "basse", "ukulélé", "ampli guitare", "platine vinyle", "vinyle", "cd", "microphone", "table de mixage", "accordéon"],
    mods: ["électrique", "acoustique", "classique", "droit", "numérique", "cordes"],
    brands: ["fender", "gibson", "yamaha", "roland", "korg", "ibanez", "casio", "marshall", "pearl", "shure", "boss"],
  },
  "loisirs/jeux-et-jouets": {
    heads: ["jeu de société", "puzzle", "lego", "playmobil", "figurine", "maquette", "carte pokémon", "jeu de cartes", "échecs", "circuit", "drone jouet", "peluche"],
    mods: ["pièces", "collection", "neuf sous blister", "boîte"],
    brands: ["lego", "playmobil", "hasbro", "ravensburger", "asmodee", "mattel", "pokémon", "warhammer"],
  },
  "loisirs/sports-et-hobbies": {
    heads: ["tapis de course", "vélo elliptique", "rameur", "haltère", "banc de musculation", "raquette", "ballon", "ski", "snowboard", "surf", "paddle", "canne à pêche", "tente", "sac de couchage", "trottinette", "roller", "skate", "kayak", "arc", "golf", "kimono", "trampoline"],
    mods: ["musculation", "fitness", "randonnée", "camping", "pêche", "tennis", "football", "kg", "cm"],
    brands: ["decathlon", "domyos", "quechua", "wilson", "babolat", "salomon", "rossignol", "shimano", "garmin"],
  },
  "loisirs/velos": {
    heads: ["vélo", "vtt", "vtc", "bicyclette", "vélo de course", "vélo électrique", "vae", "bmx", "gravel", "cadre vélo", "casque vélo", "porte-vélo"],
    mods: ["électrique", "assistance", "carbone", "aluminium", "pouces", "taille m", "shimano", "watts"],
    brands: ["btwin", "decathlon", "specialized", "trek", "giant", "cannondale", "scott", "lapierre", "moustache", "cube", "riverside", "rockrider"],
  },

  // ── Animaux ──────────────────────────────────────────────────────────────
  "animaux/animaux": {
    heads: ["chien", "chiot", "chat", "chaton", "lapin", "hamster", "cheval", "poule", "poisson", "perruche", "perroquet", "furet", "cochon d'inde", "tortue", "serpent"],
    mods: ["lof", "pucé", "vacciné", "portée", "mâle", "femelle", "à donner", "élevage", "berger", "siamois", "persan"],
  },
  "animaux/accessoires-pour-animaux": {
    heads: ["niche", "cage", "aquarium", "terrarium", "laisse", "collier chien", "gamelle", "panier chien", "arbre à chat", "litière", "harnais", "muselière", "transport chat", "croquettes"],
    mods: ["chien", "chat", "rongeur", "litres", "cm"],
  },

  // ── Services ─────────────────────────────────────────────────────────────
  "services/services-a-la-personne": {
    heads: ["ménage", "repassage", "garde d'enfants", "baby-sitting", "aide à domicile", "auxiliaire de vie", "jardinier", "homme toutes mains", "nounou", "assistante maternelle", "dame de compagnie"],
    mods: ["à domicile", "heure", "cesu", "expérience", "disponible"],
  },
  "services/reparations": {
    heads: ["dépannage", "réparation", "plombier", "électricien", "serrurier", "chauffagiste", "peintre", "maçon", "carreleur", "couvreur", "mécanicien", "informaticien", "vitrier", "menuisier"],
    mods: ["urgence", "devis gratuit", "intervention", "domicile", "artisan", "7j/7"],
  },
  "services/evenementiel": {
    heads: ["dj", "traiteur", "photographe", "vidéaste", "animateur", "magicien", "sonorisation", "location salle", "château gonflable", "food truck", "wedding planner"],
    mods: ["mariage", "anniversaire", "soirée", "séminaire", "baptême", "événement"],
  },
  "services/cours-particuliers": {
    heads: ["cours", "cours particuliers", "cours de guitare", "cours de piano", "cours de maths", "cours de langues", "soutien scolaire", "professeur", "prof", "leçon", "formation", "coach"],
    mods: ["maths", "français", "anglais", "physique", "guitare", "piano", "informatique", "code", "conduite", "domicile", "collège", "lycée", "prépa"],
  },
  "services/services-divers": {
    heads: ["déménagement", "transport", "livraison", "débarras", "nettoyage", "secrétariat", "traduction", "rédaction", "community manager", "développeur", "graphiste", "comptable"],
    mods: ["freelance", "devis", "prestation", "tarif"],
  },

  // ── Beauté & bien-être ───────────────────────────────────────────────────
  "beaute-bien-etre/massage": {
    heads: ["massage", "modelage", "massage suédois", "massage californien", "massage thaï", "réflexologie", "table de massage", "massage sportif", "shiatsu", "drainage lymphatique"],
    mods: ["relaxant", "détente", "domicile", "institut", "min", "duo", "corps"],
  },
  "beaute-bien-etre/onglerie": {
    heads: ["manucure", "pédicure", "pose ongles", "vernis semi-permanent", "gel uv", "capsules", "nail art", "onglerie", "prothésiste ongulaire"],
    mods: ["semi-permanent", "remplissage", "dépose", "french"],
  },
  "beaute-bien-etre/sourcils-et-cils": {
    heads: ["extension de cils", "rehaussement de cils", "microblading", "teinture sourcils", "restructuration sourcils", "brow lift", "volume russe"],
    mods: ["cil à cil", "hybride", "henné"],
  },
  "beaute-bien-etre/maquillage": {
    heads: ["maquillage", "maquilleuse", "make-up", "mise en beauté", "maquillage permanent", "dermopigmentation"],
    mods: ["mariée", "soirée", "cours", "professionnel"],
  },
  "beaute-bien-etre/soins-du-visage": {
    heads: ["soin du visage", "nettoyage de peau", "peeling", "hydrafacial", "microneedling", "led thérapie", "soin anti-âge", "esthéticienne"],
    mods: ["hydratant", "purifiant", "éclat", "acné"],
  },
  "beaute-bien-etre/epilation": {
    heads: ["épilation", "épilation laser", "cire", "épilation définitive", "lumière pulsée", "épilation maillot", "épilation jambes"],
    mods: ["laser", "cire tiède", "orientale", "séance", "forfait"],
  },
  "beaute-bien-etre/coiffure": {
    heads: ["coiffure", "coiffeur", "coiffeuse", "coupe", "brushing", "coloration", "balayage", "mèches", "lissage", "extensions cheveux", "tresses", "barbier", "barbe", "chignon", "défrisage", "botox capillaire"],
    mods: ["domicile", "salon", "femme", "homme", "afro", "kératine"],
  },
  "beaute-bien-etre/spa-et-detente": {
    heads: ["spa", "hammam", "sauna", "jacuzzi", "bain nordique", "balnéothérapie", "parcours bien-être"],
    mods: ["accès", "duo", "privatif", "heure"],
  },
  "beaute-bien-etre/location-d-espace-bien-etre": {
    heads: ["location cabine", "cabine esthétique", "fauteuil coiffure", "poste de travail", "location salon", "cabinet paramédical"],
    mods: ["entre professionnels", "journée", "semaine", "mois", "sous-location"],
  },
  "beaute-bien-etre/sport-et-recuperation": {
    heads: ["coach sportif", "cryothérapie", "pressothérapie", "récupération sportive", "ostéopathe du sport", "préparation physique", "electrostimulation"],
    mods: ["séance", "domicile", "personnalisé"],
  },
  "beaute-bien-etre/relaxation-et-bien-etre": {
    heads: ["sophrologie", "méditation", "yoga", "reiki", "hypnose", "naturopathie", "relaxation", "magnétiseur", "réflexologie plantaire"],
    mods: ["séance", "atelier", "stress", "sommeil"],
  },

  // ── Emploi ───────────────────────────────────────────────────────────────
  "emploi/offres-d-emploi": {
    heads: ["offre d'emploi", "recrutement", "recrute", "poste", "cdi", "cdd", "alternance", "stage", "apprentissage", "intérim", "job", "emploi"],
    mods: ["temps plein", "temps partiel", "h/f", "expérience", "salaire", "débutant accepté", "urgent recrutement"],
  },

  // ── Communauté ───────────────────────────────────────────────────────────
  "communaute/evenements": {
    heads: ["concert", "festival", "spectacle", "billet", "place", "match", "exposition", "conférence", "brocante", "vide-grenier", "loto", "tournoi"],
    mods: ["places", "date", "tribune", "entrée", "gratuit"],
  },
  "communaute/associations": {
    heads: ["association", "bénévole", "bénévolat", "collecte", "solidarité", "don", "club", "amicale", "adhésion"],
    mods: ["recherche bénévoles", "adhérents", "caritatif"],
  },
  "communaute/rencontres": {
    heads: ["rencontre", "covoiturage", "partenaire", "groupe", "sortie", "randonnée collective", "cherche joueurs", "cherche musiciens"],
    mods: ["amitié", "sorties", "loisirs", "sportif"],
  },

  // ── Matériel professionnel ───────────────────────────────────────────────
  "materiel-pro/btp-chantier": {
    heads: ["mini-pelle", "pelleteuse", "échafaudage", "bétonnière", "nacelle", "compacteur", "marteau-piqueur", "grue", "chariot élévateur", "banche", "coffrage", "container chantier"],
    mods: ["chantier", "btp", "tonnes", "heures", "professionnel"],
    brands: ["kubota", "manitou", "jcb", "caterpillar", "bobcat", "hilti"],
  },
  "materiel-pro/restauration": {
    heads: ["four professionnel", "piano de cuisson", "chambre froide", "vitrine réfrigérée", "friteuse professionnelle", "lave-vaisselle professionnel", "trancheuse", "machine à café professionnelle", "plonge", "table inox", "batteur mélangeur"],
    mods: ["restaurant", "cuisine pro", "inox", "cee", "litres"],
  },
  "materiel-pro/agriculture": {
    heads: ["tracteur", "moissonneuse", "remorque agricole", "charrue", "semoir", "épandeur", "faucheuse", "cuve", "silo", "bétaillère", "gyrobroyeur"],
    mods: ["agricole", "ferme", "cv", "hectares"],
    brands: ["john deere", "massey ferguson", "new holland", "fendt", "claas", "case ih", "kubota"],
  },
  "materiel-pro/industrie": {
    heads: ["compresseur industriel", "tour", "fraiseuse", "presse", "poste à souder", "générateur", "groupe électrogène", "transpalette", "cintreuse", "cnc", "convoyeur", "machine à commande numérique"],
    mods: ["industriel", "atelier", "triphasé", "kw"],
  },

  // ── Bébé & enfant ────────────────────────────────────────────────────────
  "bebe-enfant/puericulture": {
    heads: ["poussette", "landau", "cosy", "siège auto", "porte-bébé", "écharpe de portage", "transat", "parc", "chaise haute", "biberon", "stérilisateur", "chauffe-biberon", "tire-lait", "baignoire bébé", "table à langer", "babyphone", "youpala"],
    mods: ["bébé", "naissance", "nourrisson", "groupe 0", "groupe 1", "isofix", "poussette double"],
    brands: ["chicco", "bébé confort", "maxi-cosi", "babyzen", "yoyo", "cybex", "stokke", "béaba", "nuna", "joie", "quinny", "philips avent", "medela"],
  },
  "bebe-enfant/vetements-enfant": {
    heads: ["body", "pyjama", "grenouillère", "gigoteuse", "turbulette", "combinaison pilote", "chaussons bébé", "bavoir", "lot de vêtements"],
    mods: ["bébé", "enfant", "mois", "ans", "naissance", "3 mois", "6 mois", "12 mois", "fille", "garçon", "taille"],
    brands: ["petit bateau", "vertbaudet", "okaïdi", "kiabi", "obaïbi", "catimini"],
  },
  "bebe-enfant/jeux-et-jouets-enfant": {
    heads: ["jouet", "doudou", "peluche", "tapis d'éveil", "hochet", "trotteur", "porteur", "toboggan", "cube d'éveil", "livre d'éveil", "puzzle enfant", "poupée", "dinette", "petite voiture", "tricycle"],
    mods: ["bébé", "enfant", "éveil", "mois", "ans", "premier âge"],
    brands: ["vtech", "fisher price", "smoby", "janod", "vulli", "sophie la girafe", "little tikes"],
  },
  "bebe-enfant/mobilier-enfant": {
    heads: ["lit bébé", "lit parapluie", "berceau", "couffin", "commode à langer", "matelas bébé", "lit évolutif", "chambre bébé", "armoire enfant", "bureau enfant", "lit superposé", "barrière de lit"],
    mods: ["bébé", "enfant", "évolutif", "60x120", "70x140", "chambre"],
    brands: ["ikea", "vertbaudet", "stokke", "sauthon", "aubert"],
  },

  // ── Vacances ─────────────────────────────────────────────────────────────
  "vacances/locations-saisonnieres": {
    heads: ["location vacances", "gîte", "gite", "appartement vacances", "studio vacances", "villa vacances", "mobil-home", "chalet", "maison de vacances"],
    mods: ["semaine", "quinzaine", "juillet", "août", "bord de mer", "montagne", "piscine", "couchages", "personnes", "vacances", "saisonnière", "week-end"],
  },
  "vacances/echanges-de-maisons": {
    heads: ["échange de maison", "échange d'appartement", "home exchange", "échange logement"],
    mods: ["échange", "réciproque", "période"],
  },
  "vacances/camping": {
    heads: ["emplacement camping", "camping", "mobil-home camping", "caravane camping", "bungalow toilé"],
    mods: ["camping", "emplacement", "saison", "étoiles"],
  },
  "vacances/sejours-et-circuits": {
    heads: ["séjour", "circuit", "voyage organisé", "croisière", "week-end", "billet d'avion", "colonie de vacances", "thalasso"],
    mods: ["tout compris", "pension complète", "vol inclus", "nuits", "personnes"],
  },

  // ── Divers ───────────────────────────────────────────────────────────────
  "divers/tout-le-reste": {
    heads: ["lot divers", "objet divers", "collection", "monnaie ancienne", "timbre", "carte postale ancienne", "brocante lot"],
    mods: ["divers", "lot", "vrac"],
  },
};

/**
 * Mots du commerce, jamais catégoriels.
 *
 * « Urgent », « bon état », « cause déménagement » ne disent rien de ce qui est
 * vendu. Les compter comme les autres termes est l'une des causes du bruit
 * relevé à l'audit : un titre entièrement générique produisait une catégorie.
 */
export const GENERIC_TERMS = [
  "urgent", "vends", "à vendre", "a vendre", "cède", "cause déménagement", "cause depart",
  "neuf", "occasion", "bon état", "très bon état", "tres bon etat", "excellent état", "état neuf",
  "comme neuf", "peu servi", "jamais servi", "impeccable", "nickel", "parfait état",
  "prix", "prix négociable", "négociable", "à débattre", "a debattre", "bonne affaire", "affaire",
  "livraison possible", "remise en main propre", "sur place", "dispo", "disponible",
  "lot", "pack", "ensemble", "divers", "pro", "particulier", "classic", "classique",
  "promo", "soldes", "destockage", "déstockage", "cadeau", "offre",
];

/**
 * Modificateurs qui **déplacent** la catégorie.
 *
 * C'est la réponse au cas « Lit bébé évolutif » : « lit » est un nom-tête très
 * fort de l'ameublement, mais « bébé » ne qualifie pas le lit — il change de
 * rayon. Le rang tranche les cumuls : « siège auto bébé » contient deux
 * dominants, et c'est l'enfant qui décide, pas la voiture.
 */
export const DOMINANT_MODIFIERS: { term: string; categoryId: string; rank: number }[] = [
  { term: "bébé", categoryId: "bebe-enfant", rank: 100 },
  { term: "bebe", categoryId: "bebe-enfant", rank: 100 },
  { term: "nourrisson", categoryId: "bebe-enfant", rank: 100 },
  { term: "puériculture", categoryId: "bebe-enfant", rank: 100 },
  { term: "enfant", categoryId: "bebe-enfant", rank: 80 },
  { term: "massage", categoryId: "beaute-bien-etre", rank: 95 },
  { term: "esthétique", categoryId: "beaute-bien-etre", rank: 90 },
  { term: "coiffure", categoryId: "beaute-bien-etre", rank: 90 },
  { term: "épilation", categoryId: "beaute-bien-etre", rank: 90 },
  { term: "onglerie", categoryId: "beaute-bien-etre", rank: 90 },
  { term: "chien", categoryId: "animaux", rank: 85 },
  { term: "chat", categoryId: "animaux", rank: 85 },
  { term: "chiot", categoryId: "animaux", rank: 85 },
  { term: "chaton", categoryId: "animaux", rank: 85 },
  { term: "agricole", categoryId: "materiel-pro", rank: 75 },
  { term: "chantier", categoryId: "materiel-pro", rank: 75 },
  { term: "professionnel", categoryId: "materiel-pro", rank: 40 },
  { term: "gaming", categoryId: "multimedia", rank: 70 },
  { term: "auto", categoryId: "vehicules", rank: 60 },
  { term: "voiture", categoryId: "vehicules", rank: 60 },
  { term: "vélo", categoryId: "loisirs", rank: 65 },
  { term: "location", categoryId: "immobilier", rank: 30 },
  { term: "cours", categoryId: "services", rank: 72 },
  { term: "soutien", categoryId: "services", rank: 72 },
  { term: "professeur", categoryId: "services", rank: 72 },
  { term: "depannage", categoryId: "services", rank: 70 },
  { term: "vacances", categoryId: "vacances", rank: 68 },
  { term: "saisonniere", categoryId: "vacances", rank: 68 },
  { term: "couchages", categoryId: "vacances", rank: 60 },
  { term: "recrute", categoryId: "emploi", rank: 90 },
  { term: "recrutement", categoryId: "emploi", rank: 90 },
  { term: "cdi", categoryId: "emploi", rank: 85 },
  { term: "cdd", categoryId: "emploi", rank: 85 },
];

/** Fautes de frappe fréquentes, observées ou plausibles. */
export const COMMON_TYPOS: Record<string, string> = {
  peugot: "peugeot", peugeout: "peugeot", pegeot: "peugeot",
  iphne: "iphone", ipone: "iphone", iphon: "iphone", ifone: "iphone",
  canappe: "canapé", canapee: "canapé", canpé: "canapé",
  refregirateur: "réfrigérateur", refrigerateur: "réfrigérateur",
  ordinateurr: "ordinateur", ordianteur: "ordinateur",
  apartement: "appartement", appartment: "appartement", appartemment: "appartement",
  velo: "vélo", vellos: "vélos",
  chausure: "chaussure", chaussur: "chaussure",
  bebe: "bébé", bébee: "bébé",
  masage: "massage", massge: "massage", sporrtif: "sportif",
  mercedez: "mercedes", renaut: "renault", citroen: "citroën",
  playstaion: "playstation", nintando: "nintendo",
  televiseur: "téléviseur", telephone: "téléphone",
  poussete: "poussette", pousette: "poussette",
};

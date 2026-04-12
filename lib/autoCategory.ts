/**
 * Automatic category + subcategory detection from listing title.
 * Uses keyword matching (case-insensitive, accent-insensitive).
 */

type Match = { categoryId: string; subcategory: string };

// Normalize: lowercase + remove accents
function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// [keywords[], categoryId, subcategory]
const RULES: [string[], string, string][] = [
  // ── Téléphonie ──────────────────────────────────────────────────────────
  [
    ["iphone", "ipad", "ipod", "samsung galaxy", "huawei", "xiaomi", "oneplus",
     "google pixel", "sony xperia", "oppo", "realme", "nothing phone",
     "smartphone", "telephone", "mobile", "sim"],
    "multimedia", "Téléphonie",
  ],

  // ── Informatique ────────────────────────────────────────────────────────
  [
    ["macbook", "imac", "mac mini", "mac pro", "ordinateur", "laptop", "pc portable",
     "pc bureau", "dell", "lenovo", "thinkpad", "hp elitebook", "asus", "acer",
     "processeur", "carte graphique", "ram", "ssd", "disque dur", "clavier", "souris",
     "ecran pc", "moniteur", "imprimante", "scanner"],
    "multimedia", "Informatique",
  ],

  // ── Consoles & jeux vidéo ────────────────────────────────────────────────
  [
    ["playstation", "ps4", "ps5", "xbox", "nintendo", "switch", "gameboy",
     "manette", "jeu video", "jeux video", "console", "steam deck", "oculus",
     "casque vr"],
    "multimedia", "Consoles & jeux vidéo",
  ],

  // ── Image & son ─────────────────────────────────────────────────────────
  [
    ["television", "tv ", "smart tv", "ecran tv", "projecteur", "videoprojecteur",
     "enceinte", "barre de son", "home cinema", "amplificateur", "ampli",
     "casque audio", "airpods", "ecouteurs", "appareil photo", "camera",
     "objectif photo", "drone", "gopro", "sonos", "bose", "jbl", "yamaha ampli"],
    "multimedia", "Image & son",
  ],

  // ── Voitures ────────────────────────────────────────────────────────────
  [
    ["voiture", "auto ", "automobile", "berline", "suv", "4x4", "break", "coupe",
     "cabriolet", "renault", "peugeot", "citroen", "volkswagen", "vw ", "bmw",
     "mercedes", "audi", "toyota", "ford", "opel", "fiat", "seat", "skoda",
     "hyundai", "kia", "tesla", "porsche", "ferrari", "lamborghini"],
    "vehicules", "Voitures",
  ],

  // ── Motos ───────────────────────────────────────────────────────────────
  [
    ["moto", "scooter", "mobylette", "125cc", "harley", "kawasaki", "ducati",
     "yamaha moto", "honda moto", "suzuki moto", "ktm", "triumph", "royal enfield"],
    "vehicules", "Motos",
  ],

  // ── Caravaning ──────────────────────────────────────────────────────────
  [["caravane", "camping-car", "campingcar", "fourgon amenage", "van amenage"], "vehicules", "Caravaning"],

  // ── Utilitaires ─────────────────────────────────────────────────────────
  [["camion", "fourgon", "utilitaire", "benne", "semi-remorque"], "vehicules", "Utilitaires"],

  // ── Équipements auto ────────────────────────────────────────────────────
  [["pneu", "jante", "autoradio", "siege auto", "coffre de toit", "attelage"], "vehicules", "Équipements auto"],

  // ── Ventes immobilières ─────────────────────────────────────────────────
  [
    ["appartement", "maison", "villa", "studio", "loft", "duplex", "triplex",
     "vente immobilier", "achat immobilier", "terrain", "parking", "cave"],
    "immobilier", "Ventes immobilières",
  ],

  // ── Locations ───────────────────────────────────────────────────────────
  [["location appartement", "location maison", "louer", "loyer", "bail"], "immobilier", "Locations"],

  // ── Colocations ─────────────────────────────────────────────────────────
  [["colocation", "coloc", "chambre a louer"], "immobilier", "Colocations"],

  // ── Ameublement ─────────────────────────────────────────────────────────
  [
    ["canape", "sofa", "fauteuil", "table basse", "table a manger", "chaise",
     "lit ", "matelas", "sommier", "armoire", "commode", "etagere", "bureau",
     "biblioth", "meuble", "buffet", "dressing"],
    "maison", "Ameublement",
  ],

  // ── Électroménager ──────────────────────────────────────────────────────
  [
    ["lave-linge", "lavelinge", "machine a laver", "lave-vaisselle", "lavavaisselle",
     "refrigerateur", "frigo", "congelateur", "four ", "micro-onde", "microonde",
     "hotte", "plaque de cuisson", "aspirateur", "robot cuiseur", "thermomix",
     "seche-linge", "seche linge"],
    "maison", "Électroménager",
  ],

  // ── Jardinage ───────────────────────────────────────────────────────────
  [["tondeuse", "taille-haie", "debroussailleuse", "jardin", "potager", "serre", "arrosage"], "maison", "Jardinage"],

  // ── Bricolage ───────────────────────────────────────────────────────────
  [["perceuse", "visseuse", "scie", "marteau", "echelle", "outil", "bricolage", "ponceuse"], "maison", "Bricolage"],

  // ── Vêtements ───────────────────────────────────────────────────────────
  [
    ["robe", "manteau", "veste", "blouson", "jean ", "pantalon", "chemise",
     "pull", "t-shirt", "tshirt", "sweat", "short", "jupe", "combinaison",
     "vetement", "habits", "parka", "anorak", "doudoune"],
    "mode", "Vêtements",
  ],

  // ── Chaussures ──────────────────────────────────────────────────────────
  [["chaussure", "basket", "sneaker", "boots", "botte", "sandale", "escarpin", "mocassin"], "mode", "Chaussures"],

  // ── Accessoires & bagagerie ──────────────────────────────────────────────
  [["sac a main", "sacoche", "valise", "bagage", "sac a dos", "portefeuille", "ceinture"], "mode", "Accessoires & bagagerie"],

  // ── Montres & bijoux ────────────────────────────────────────────────────
  [["montre", "bracelet", "collier", "bague", "bijou", "alliance", "boucles d'oreilles"], "mode", "Montres & bijoux"],

  // ── Livres ──────────────────────────────────────────────────────────────
  [["livre", "roman", "bande dessinee", "manga", "bd ", "encyclopedie"], "loisirs", "Livres"],

  // ── DVD / Films ─────────────────────────────────────────────────────────
  [["dvd", "blu-ray", "bluray", "film ", "serie tv"], "loisirs", "DVD / Films"],

  // ── Musique / Instruments ────────────────────────────────────────────────
  [["guitare", "basse ", "piano", "clavier midi", "batterie", "violon", "trompette", "instrument de musique", "vinyle", "platine"], "loisirs", "Musique / Instruments"],

  // ── Vélos ───────────────────────────────────────────────────────────────
  [["velo", "trottinette", "patinette", "vtt", "velo electrique"], "loisirs", "Vélos"],

  // ── Sports & hobbies ────────────────────────────────────────────────────
  [["surf", "ski", "snowboard", "kayak", "tente", "randonnee", "fitness", "musculation", "haltere", "velo de course", "sport"], "loisirs", "Sports & hobbies"],

  // ── Jeux & jouets ────────────────────────────────────────────────────────
  [["jouet", "lego", "puzzle", "peluche", "poupee", "figurine", "jeu de societe"], "loisirs", "Jeux & jouets"],

  // ── Animaux ─────────────────────────────────────────────────────────────
  [["chien", "chiot", "chat", "chaton", "lapin", "perroquet", "oiseau", "hamster", "cochon d'inde", "cheval", "poney", "poisson"], "animaux", "Animaux"],

  // ── Accessoires pour animaux ─────────────────────────────────────────────
  [["niche", "cage", "aquarium", "terrarium", "litiere", "croquette", "laisse", "collier chien"], "animaux", "Accessoires pour animaux"],

  // ── Cours particuliers ──────────────────────────────────────────────────
  [["cours ", "lecon ", "tutorat", "soutien scolaire", "coaching"], "services", "Cours particuliers"],

  // ── Offres d'emploi ─────────────────────────────────────────────────────
  [["offre d'emploi", "recrutement", "cdi", "cdd", "stage ", "alternance", "apprentissage"], "emploi", "Offres d'emploi"],
];

export function detectCategory(title: string): Match | null {
  if (!title || title.trim().length < 3) return null;
  const normalized = normalize(title);

  for (const [keywords, categoryId, subcategory] of RULES) {
    for (const kw of keywords) {
      if (normalized.includes(normalize(kw))) {
        return { categoryId, subcategory };
      }
    }
  }
  return null;
}

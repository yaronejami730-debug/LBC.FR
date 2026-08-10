/**
 * Copie de secours du référentiel de publication.
 *
 * La source de vérité est le site : lib/categories.ts, servi par
 * /api/taxonomy. Ce fichier ne sert qu'au premier lancement et au hors ligne —
 * `lib/taxonomy.ts` le remplace par la réponse du serveur dès qu'elle arrive.
 *
 * Le garder synchrone avec le web reste utile mais n'est plus critique : une
 * catégorie ajoutée au site apparaît dans l'app sans nouvelle build.
 */

export type Category = {
  id: string;
  label: string;
  subcategories: string[];
  /** Une prestation n'a ni état ni « article » : le formulaire s'y adapte. */
  kind?: "bien" | "prestation";
};

export const CATEGORIES: Category[] = [
  { id: "immobilier", label: "Immobilier", subcategories: ["Ventes immobilières", "Locations", "Colocations", "Bureaux & commerces", "Locations de vacances"] },
  { id: "vehicules", label: "Véhicules", subcategories: ["Voitures", "Motos", "Caravaning", "Utilitaires", "Équipements auto"] },
  { id: "maison", label: "Maison", subcategories: ["Ameublement", "Électroménager", "Arts de la table", "Décoration", "Linge de maison", "Bricolage", "Jardinage"] },
  { id: "multimedia", label: "Multimédia", subcategories: ["Informatique", "Consoles & jeux vidéo", "Image & son", "Téléphonie"] },
  { id: "mode", label: "Mode", subcategories: ["Vêtements", "Chaussures", "Accessoires & bagagerie", "Montres & bijoux"] },
  { id: "loisirs", label: "Loisirs", subcategories: ["DVD / Films", "Livres", "Musique / Instruments", "Jeux & jouets", "Sports & hobbies", "Vélos"] },
  { id: "animaux", label: "Animaux", subcategories: ["Animaux", "Accessoires pour animaux"] },
  { id: "services", kind: "prestation", label: "Services", subcategories: ["Services à la personne", "Réparations", "Événementiel", "Cours particuliers", "Services divers"] },
  {
    id: "beaute-bien-etre",
    kind: "prestation",
    label: "Beauté & Bien-être",
    subcategories: [
      "Massage", "Onglerie", "Sourcils & cils", "Maquillage", "Soins du visage",
      "Épilation", "Coiffure", "Spa & détente", "Location d'espace bien-être",
      "Sport & récupération", "Relaxation & bien-être",
    ],
  },
  { id: "emploi", kind: "prestation", label: "Emploi", subcategories: ["Offres d'emploi"] },
  { id: "communaute", kind: "prestation", label: "Communauté", subcategories: ["Événements", "Associations", "Rencontres"] },
  { id: "materiel-pro", label: "Matériel professionnel", subcategories: ["BTP / chantier", "Restauration", "Agriculture", "Industrie"] },
  { id: "bebe-enfant", label: "Bébé & Enfant", subcategories: ["Puériculture", "Vêtements enfant", "Jeux & jouets enfant", "Mobilier enfant"] },
  { id: "vacances", kind: "prestation", label: "Vacances", subcategories: ["Locations saisonnières", "Échanges de maisons", "Camping", "Séjours & circuits"] },
  { id: "divers", label: "Divers", subcategories: ["Tout le reste"] },
];

export const CONDITIONS = ["Neuf", "Très bon état", "Bon état", "État correct", "Pour pièces"];

export const WELLNESS_CATEGORY_ID = "beaute-bien-etre";

/** Rubrique qui vend une prestation : ni état, ni vocabulaire « article ». */
export function isPrestation(category: Category | null | undefined): boolean {
  return category?.kind === "prestation";
}

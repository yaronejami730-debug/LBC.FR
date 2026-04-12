export type Category = {
  id: string;
  label: string;
  icon: string;
  subcategories: string[];
};

export const CATEGORIES: Category[] = [
  {
    id: "immobilier",
    label: "Immobilier",
    icon: "home",
    subcategories: ["Ventes immobilières", "Locations", "Colocations", "Bureaux & commerces", "Locations de vacances"],
  },
  {
    id: "vehicules",
    label: "Véhicules",
    icon: "directions_car",
    subcategories: ["Voitures", "Motos", "Caravaning", "Utilitaires", "Équipements auto"],
  },
  {
    id: "maison",
    label: "Maison",
    icon: "king_bed",
    subcategories: ["Ameublement", "Électroménager", "Arts de la table", "Décoration", "Linge de maison", "Bricolage", "Jardinage"],
  },
  {
    id: "multimedia",
    label: "Multimédia",
    icon: "devices",
    subcategories: ["Informatique", "Consoles & jeux vidéo", "Image & son", "Téléphonie"],
  },
  {
    id: "mode",
    label: "Mode",
    icon: "checkroom",
    subcategories: ["Vêtements", "Chaussures", "Accessoires & bagagerie", "Montres & bijoux"],
  },
  {
    id: "loisirs",
    label: "Loisirs",
    icon: "sports_esports",
    subcategories: ["DVD / Films", "Livres", "Musique / Instruments", "Jeux & jouets", "Sports & hobbies", "Vélos"],
  },
  {
    id: "animaux",
    label: "Animaux",
    icon: "pets",
    subcategories: ["Animaux", "Accessoires pour animaux"],
  },
  {
    id: "services",
    label: "Services",
    icon: "handyman",
    subcategories: ["Services à la personne", "Réparations", "Événementiel", "Cours particuliers", "Services divers"],
  },
  {
    id: "emploi",
    label: "Emploi",
    icon: "work",
    subcategories: ["Offres d'emploi"],
  },
  {
    id: "communaute",
    label: "Communauté",
    icon: "groups",
    subcategories: ["Événements", "Associations", "Rencontres"],
  },
  {
    id: "materiel-pro",
    label: "Matériel professionnel",
    icon: "construction",
    subcategories: ["BTP / chantier", "Restauration", "Agriculture", "Industrie"],
  },
  {
    id: "divers",
    label: "Divers",
    icon: "more_horiz",
    subcategories: ["Tout le reste"],
  },
];

export function getCategoryById(id: string) {
  return CATEGORIES.find((c) => c.id === id);
}

export function getCategoryByLabel(label: string) {
  return CATEGORIES.find((c) => c.label === label);
}

export type Category = {
  id: string;
  label: string;
  icon: string;
  subcategories: string[];
  /**
   * Ce que l'annonce vend réellement. Une prestation n'a pas d'état ni
   * d'accessoires : demander « Neuf / Bon état » pour une manucure n'a aucun
   * sens, et le mot « article » non plus. Le formulaire s'adapte là-dessus.
   */
  kind?: "bien" | "prestation";
};

/**
 * Catégories mises en avant pour le SEO et la home (bento + sections dédiées).
 * Les autres restent listées et accessibles pour la publication, mais reçoivent
 * un traitement visuel plus discret.
 */
export const FEATURED_CATEGORY_IDS = new Set(["immobilier", "vehicules"]);

export function isFeaturedCategory(id: string): boolean {
  return FEATURED_CATEGORY_IDS.has(id);
}

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
    kind: "prestation",
    label: "Services",
    icon: "handyman",
    subcategories: ["Services à la personne", "Réparations", "Événementiel", "Cours particuliers", "Services divers"],
  },
  {
    id: "beaute-bien-etre",
    kind: "prestation",
    label: "Beauté & Bien-être",
    icon: "spa",
    // Prestations de salon uniquement : toute connotation sensuelle est
    // bannie par lib/moderation/wellness-policy.ts.
    // Alignées sur lib/wellness/taxonomy.ts, qui porte le niveau 3 (type
    // d'annonce) et les axes tarif / durée / capacité / public.
    subcategories: [
      "Massage",
      "Onglerie",
      "Sourcils & cils",
      "Maquillage",
      "Soins du visage",
      "Épilation",
      "Coiffure",
      "Spa & détente",
      "Location d'espace bien-être",
      "Sport & récupération",
      "Relaxation & bien-être",
    ],
  },
  {
    id: "emploi",
    kind: "prestation",
    label: "Emploi",
    icon: "work",
    subcategories: ["Offres d'emploi"],
  },
  {
    id: "communaute",
    kind: "prestation",
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
    id: "bebe-enfant",
    label: "Bébé & Enfant",
    icon: "child_care",
    subcategories: ["Puériculture", "Vêtements enfant", "Jeux & jouets enfant", "Mobilier enfant"],
  },
  {
    id: "vacances",
    kind: "prestation",
    label: "Vacances",
    icon: "beach_access",
    subcategories: ["Locations saisonnières", "Échanges de maisons", "Camping", "Séjours & circuits"],
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

/** Rubrique qui vend une prestation : ni état, ni vocabulaire « article ». */
export function isPrestationCategory(idOrLabel: string | null | undefined): boolean {
  if (!idOrLabel) return false;
  const cat =
    CATEGORIES.find((c) => c.id === idOrLabel) ?? CATEGORIES.find((c) => c.label === idOrLabel);
  return cat?.kind === "prestation";
}

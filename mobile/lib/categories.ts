export type Category = {
  id: string;
  label: string;
  subcategories: string[];
};

export const CATEGORIES: Category[] = [
  { id: "immobilier", label: "Immobilier", subcategories: ["Ventes immobilières", "Locations", "Colocations", "Bureaux & commerces", "Locations de vacances"] },
  { id: "vehicules", label: "Véhicules", subcategories: ["Voitures", "Motos", "Caravaning", "Utilitaires", "Équipements auto"] },
  { id: "emploi", label: "Emploi", subcategories: ["Offres d'emploi", "Formations professionnelles"] },
  { id: "mode", label: "Mode", subcategories: ["Vêtements", "Chaussures", "Accessoires & Bagagerie", "Montres & Bijoux"] },
  { id: "maison", label: "Maison", subcategories: ["Ameublement", "Électroménager", "Arts de la table", "Décoration", "Linge de maison", "Bricolage", "Jardinage"] },
  { id: "multimedia", label: "Multimédia", subcategories: ["Informatique", "Téléphones & Objets connectés", "Image & Son", "Consoles & Jeux vidéo"] },
  { id: "loisirs", label: "Loisirs", subcategories: ["DVD / Films", "CD / Musique", "Livres", "Sport & Plein Air", "Vélos", "Instruments de musique", "Jeux & Jouets", "Modélisme", "Vins & Gastronomie"] },
  { id: "animaux", label: "Animaux", subcategories: ["Chiens", "Chats", "Autres animaux", "Accessoires animaux"] },
  { id: "materiel-pro", label: "Matériel professionnel", subcategories: ["Tracteurs", "BTP - Chantier", "Matériel agricole", "Équipements pros"] },
  { id: "services", label: "Services", subcategories: ["Services à la personne", "Événements", "Artisans & Musiciens", "Billetterie", "Cours particuliers"] },
  { id: "autre", label: "Autre", subcategories: [] },
];

export const CONDITIONS = ["Neuf", "Très bon état", "Bon état", "État correct", "Pour pièces"];

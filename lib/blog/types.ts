export type BlogArticle = {
  slug: string;
  title: string;
  /**
   * Titre affiché en haut de l'article, quand il doit différer de la balise
   * `<title>`. La balise vise la requête telle qu'elle est tapée ; le titre de
   * page s'adresse au lecteur déjà arrivé. Absent : les deux sont identiques,
   * ce qui reste le cas de la plupart des articles.
   */
  h1?: string;
  description: string;
  /**
   * Signature éditoriale affichée à côté des dates. Absent : le rendu retombe
   * sur « La rédaction Deal&Co », ce qui reste honnête pour du contenu généré
   * par IA puis relu — jamais de nom de personne inventé.
   */
  author?: string;
  publishedAt: string;
  updatedAt: string;
  category: string;
  keywords: string[];
  intro: string;
  sections: { h2: string; paragraphs: string[] }[];
  faq: { q: string; a: string }[];
  relatedCategoryId?: string;
};

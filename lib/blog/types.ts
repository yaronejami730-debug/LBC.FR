export type BlogArticle = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  category: string;
  keywords: string[];
  intro: string;
  sections: { h2: string; paragraphs: string[] }[];
  faq: { q: string; a: string }[];
  relatedCategoryId?: string;
};

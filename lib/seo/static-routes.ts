/**
 * Slugs des pages éditoriales à paramètre fixe.
 *
 * Ces routes déclarent `dynamicParams = false` : l'ensemble des URL valides est
 * connu à la compilation. On les recopie ici pour que le sitemap n'ait pas à
 * importer les modules de page (qui embarquent tout l'arbre de composants).
 *
 * ⚠️ En ajoutant un slug dans l'une des pages ci-dessous, l'ajouter ici aussi —
 * sinon la page existe mais n'est jamais soumise à Google.
 */

/** Source : app/comparatif/[paire]/page.tsx → PAIRS */
export const COMPARATIF_SLUGS = [
  "peugeot-208-vs-renault-clio",
  "citroen-c3-vs-renault-clio",
  "peugeot-308-vs-renault-megane",
  "volkswagen-golf-vs-peugeot-308",
  "dacia-sandero-vs-renault-clio",
  "toyota-yaris-vs-renault-clio",
  "peugeot-3008-vs-renault-kadjar",
  "bmw-serie-3-vs-audi-a4",
  "mercedes-classe-a-vs-bmw-serie-1",
  "audi-a3-vs-bmw-serie-1",
  "tesla-model-3-vs-peugeot-e-208",
] as const;

/** Source : app/voiture/[slug]/page.tsx → CLUSTERS */
export const VOITURE_CLUSTER_SLUGS = [
  "electrique-occasion",
  "hybride-occasion",
  "diesel-occasion",
  "essence-occasion",
  "suv-occasion",
  "berline-occasion",
  "citadine-occasion",
  "break-occasion",
] as const;

/** Source : app/voiture-budget/[tranche]/page.tsx → BUDGETS */
export const VOITURE_BUDGET_SLUGS = [
  "moins-de-3000-euros",
  "moins-de-5000-euros",
  "moins-de-8000-euros",
  "moins-de-12000-euros",
  "moins-de-20000-euros",
] as const;

/**
 * Pages informationnelles permanentes. `/search` en est volontairement absent
 * (noindex), tout comme les tunnels de compte.
 */
export const STATIC_PAGES = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/nouveautes", changeFrequency: "hourly", priority: 0.9 },
  { path: "/annonces", changeFrequency: "daily", priority: 0.9 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.8 },
  { path: "/comparatif", changeFrequency: "weekly", priority: 0.7 },
  { path: "/voiture-budget", changeFrequency: "weekly", priority: 0.7 },
  { path: "/a-propos", changeFrequency: "monthly", priority: 0.6 },
  // `/securite` retiré : la page est une galerie de composants, pas un contenu
  // publiable. Voir le commentaire en tête de `app/securite/page.tsx`.
  { path: "/contact", changeFrequency: "yearly", priority: 0.4 },
  { path: "/api-doc", changeFrequency: "monthly", priority: 0.4 },
  { path: "/mentions-legales", changeFrequency: "yearly", priority: 0.2 },
  { path: "/cgu", changeFrequency: "yearly", priority: 0.2 },
  { path: "/confidentialite", changeFrequency: "yearly", priority: 0.2 },
] as const;

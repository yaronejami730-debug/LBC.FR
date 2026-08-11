import type { MetadataRoute } from "next";

/**
 * Chemins fermés à l'exploration.
 *
 * Deux catégories, et une seule raison de figurer ici : la page n'a aucune
 * chance de répondre à une requête d'internaute.
 *
 *   — espaces privés (compte, messagerie, administration) ;
 *   — tunnels d'action sur une annonce (`/annonce/*​/edit`, `/annonce/*​/republier`),
 *     qui redirigent vers la connexion et faisaient explorer une chaîne de
 *     redirections pour rien, sur chacune des annonces du site.
 *
 * Les tunnels de compte (`/login`, `/register`, mots de passe) ne sont
 * volontairement **pas** listés : ils portent désormais `noindex` dans leur
 * metadata, et une page bloquée au crawl ne peut pas transmettre sa directive
 * `noindex` — Google peut alors l'indexer sans jamais l'avoir lue, sur la seule
 * foi des liens entrants. Interdire l'exploration et interdire l'indexation ne
 * sont pas la même chose ; ici c'est la seconde qu'on veut.
 */
const PRIVATE_PATHS = [
  "/admin",
  "/api/",
  "/post",
  "/profile",
  "/messages",
  "/favoris",
  "/recherches",
  "/mes-reservations",
  "/mon-agenda",
  "/preferences",
  "/annonce/*/edit",
  "/annonce/*/republier",
];

/**
 * Robots des moteurs génératifs et des collecteurs d'entraînement.
 *
 * Ils reçoivent exactement les mêmes règles que Googlebot — pas plus
 * permissives, pas plus restrictives. Deal&Co a intérêt à ce qu'un assistant
 * puisse citer une fiche professionnelle ou une page locale quand elle répond
 * réellement à la question posée : c'est une source de visites qualifiées, et
 * la donnée exposée est déjà publique.
 *
 * Les déclarer nommément plutôt que de compter sur `User-Agent: *` est
 * délibéré : plusieurs de ces robots ignorent le joker et ne lisent que le bloc
 * portant leur nom.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "cohere-ai",
  "Bytespider",
  "Amazonbot",
  "Meta-ExternalAgent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow: PRIVATE_PATHS })),
    ],
    sitemap: "https://www.dealandcompany.fr/sitemap.xml",
    host: "https://www.dealandcompany.fr",
  };
}

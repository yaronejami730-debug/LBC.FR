import type { MetadataRoute } from "next";

/**
 * Chemins fermés à l'exploration.
 *
 * Trois catégories, et une seule raison de figurer ici : la page n'a aucune
 * chance de répondre à une requête d'internaute.
 *
 *   — espaces privés (compte, messagerie, administration) ;
 *   — tunnels d'action sur une annonce (`/annonce/*​/edit`, `/annonce/*​/republier`),
 *     qui redirigent vers la connexion et faisaient explorer une chaîne de
 *     redirections pour rien, sur chacune des annonces du site ;
 *   — espaces d'URL **infinis** : `/login?callbackUrl=…` et `/search?q=…`.
 *
 * Sur ces deux derniers, une remarque s'impose, parce qu'elle contredit le
 * commentaire qui vivait ici et qui les excluait délibérément de cette liste.
 *
 * L'argument était juste dans le cas général : une page bloquée au crawl ne
 * peut pas transmettre sa directive `noindex`, donc bloquer ce qu'on veut
 * désindexer laisse la page coincée dans l'index, indexée sur la seule foi des
 * liens entrants. Cela ne vaut que pour une page **déjà indexée**.
 *
 * Ce n'est pas le cas ici. Search Console les classe au 12/08/2026 en « exclue
 * par la balise noindex » : Google les a lues, il a obéi, elles ne sont pas
 * dans l'index — et il continue pourtant de les explorer une par une. Or il y
 * en a une par valeur de `callbackUrl` et une par requête tapée par un
 * visiteur : l'espace est illimité, il croît tout seul, et il consommait une
 * part mesurable d'un budget d'exploration déjà saturé (2 280 URL connues,
 * 6,7 % retenues, 234 URL détectées et jamais explorées).
 *
 * Le `noindex` a donc fait son travail et n'a plus rien à transmettre. Le
 * blocage est sûr, et son effet sur le budget est immédiat.
 *
 * Les autres tunnels de compte (`/register`, mots de passe) restent hors de
 * cette liste : ils sont en nombre fini, leur `noindex` suffit, et rien ne
 * justifie de leur retirer la possibilité de le déclarer.
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
  // Variante connectée de la fiche, servie par réécriture du middleware.
  // L'URL n'est jamais émise nulle part, mais elle reste tapable, et elle rend
  // exactement le même écran que la fiche publique : indexée, ce serait un
  // doublon parfait de chaque annonce du site.
  "/annonce/*/moi",
  // Espaces infinis — voir le commentaire ci-dessus.
  "/login",
  "/search",
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
    sitemap: ["https://www.dealandcompany.fr/sitemap.xml"],
    host: "https://www.dealandcompany.fr",
  };
}

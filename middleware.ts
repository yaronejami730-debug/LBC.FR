import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { INTENT_COOKIE, INTENT_MAX_AGE, encodeIntent, readLandingIntent } from "./lib/ads/intent-cookie";

const { auth } = NextAuth(authConfig);

// « /favorites » est resté d'une ancienne route ; la page vit sur « /favoris ».
// Les deux figurent : retirer l'ancienne n'apporte rien, la laisser seule
// laissait la vraie page hors du contrôle.
const PROTECTED = [
  "/messages",
  "/profile",
  "/post",
  "/favorites",
  "/favoris",
  "/brouillons",
  "/mes-annonces",
  "/mes-reservations",
];

// Scrapers that should not trigger auth middleware (no cookies)
const SCRAPER_AGENTS = [
  "WhatsApp",
  "facebookexternalhit",
  "Discordbot",
  "Slackbot",
  "Telegrambot",
  "Twitterbot",
  "linkedinbot",
  "Pinterestbot",
  "vkShare",
  "redditbot",
];

function isScraperBot(userAgent: string): boolean {
  return SCRAPER_AGENTS.some((agent) => userAgent.includes(agent));
}

/**
 * Chemins qui exigent réellement une session.
 *
 * ── Pourquoi cette liste existe ───────────────────────────────────────────
 *
 * Le middleware était intégralement enveloppé dans `auth()`. Conséquence
 * mesurée le 19/08/2026 en production, sur `/`, `/blog`, `/annonces`,
 * `/ville/paris` et une fiche d'annonce, aussi bien pour Googlebot que pour un
 * navigateur ordinaire :
 *
 *     cache-control: private, no-cache, no-store, max-age=0, must-revalidate
 *     set-cookie: __Host-authjs.csrf-token=…
 *
 * NextAuth touche la session à chaque requête, pose un cookie, et la réponse
 * devient non stockable. Deux effets, tous deux invisibles en développement :
 *
 *   1. les en-têtes `public, s-maxage=3600, stale-while-revalidate=86400`
 *      déclarés dans `next.config.ts` pour `/annonces/:path*` et `/ville/:slug`
 *      n'atteignaient jamais le CDN — ils étaient écrasés ;
 *   2. le cache de Vercel ne pouvait servir aucune page. Chaque visite de
 *      Googlebot repartait à l'origine, rejouait les requêtes Prisma et payait
 *      le TTFB correspondant. Or le taux d'exploration de Google est indexé sur
 *      ce temps de réponse : un site lent est exploré moins souvent. C'est le
 *      mécanisme qui affamait le budget de crawl, pendant qu'on cherchait la
 *      cause dans `robots.txt`.
 *
 * ── Ce que la correction ne fait pas ──────────────────────────────────────
 *
 * Elle ne traite pas Googlebot autrement qu'un visiteur : ce serait du
 * cloaking, et la branche `isScraperBot` existante en frôle déjà la limite.
 * Elle retire `auth()` du chemin des pages **publiques, pour tout le monde** —
 * un visiteur anonyme sur `/blog` n'a aucune raison de déclencher une lecture
 * de session.
 *
 * Le reste du middleware — bascule Pet, en-tête `x-pathname`, cookie
 * d'intention — continue de s'exécuter sur toutes les routes, session ou non.
 *
 * ⚠️ Toute nouvelle route exigeant une session doit être ajoutée ici **et**
 * garder sa propre vérification côté serveur : le middleware ferme la porte,
 * il n'est pas la serrure.
 */
const AUTH_PREFIXES = [...PROTECTED, "/admin"];

function needsSession(pathname: string): boolean {
  return AUTH_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * Traitements communs à toutes les requêtes, avec ou sans session.
 *
 * Renvoie une réponse à servir telle quelle, ou `null` pour « poursuivre ».
 * Rendre l'ordre explicite est délibéré : la bascule Pet doit passer avant tout
 * contrôle de session, sinon une route Pet désactivée renverrait une
 * redirection de connexion au lieu d'un 404.
 */
function commonRouting(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  const userAgent = req.headers.get("user-agent") || "";
  const host = req.headers.get("host") || "";

  const petEnabled = process.env.PET_PUBLIC === "true";
  const isPetSubdomain = host.startsWith("pet.");
  const isPetPath = pathname === "/pet" || pathname.startsWith("/pet/");
  if (!petEnabled && (isPetSubdomain || isPetPath)) {
    const url = req.nextUrl.clone();
    url.pathname = "/_pet-disabled";
    return NextResponse.rewrite(url);
  }

  if (isPetSubdomain && !pathname.startsWith("/pet") && !pathname.startsWith("/api") && !pathname.startsWith("/_next")) {
    const url = req.nextUrl.clone();
    url.pathname = `/pet${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  if (pathname.includes("/opengraph-image")) {
    return NextResponse.next();
  }

  if (isScraperBot(userAgent)) {
    const response = NextResponse.next();
    response.headers.set("cache-control", "public, max-age=3600");
    return response;
  }

  return null;
}

/** Branche avec session : inchangée, mais réservée aux chemins qui l'exigent. */
const withSession = auth((req: any) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!isLoggedIn) return NextResponse.redirect(new URL("/admin/login", req.nextUrl.origin));
    const role = (req.auth?.user as any)?.role;
    if (role !== "ADMIN") return NextResponse.redirect(new URL("/admin/login", req.nextUrl.origin));
  }

  if (PROTECTED.some((p) => pathname.startsWith(p)) && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return withLandingIntent(req, nextWithPathname(req));
});

/**
 * Aiguillage de la fiche d'annonce : anonyme au CDN, connecté à l'origine.
 *
 * ── Le problème qu'il résout ──────────────────────────────────────────────
 *
 * `/annonce/:id/:slug` appelait `auth()` pendant son rendu. Lire la session
 * bascule la route en dynamique, et Next répond alors
 * `cache-control: private, no-cache, no-store` — qui écrase l'en-tête
 * `public, s-maxage=600` déclaré pour `/annonce/:path*` dans `next.config.ts`.
 *
 * Relevé du 28/08/2026 sur les 362 URL du crawl d'audit : `MISS 284, HIT 75`,
 * dont **213 MISS sur `/annonce/*`**. Chaque visite de Googlebot sur chaque
 * fiche rejouait le rendu et ses requêtes Prisma, pour un résultat identique
 * d'un visiteur anonyme à l'autre.
 *
 * ── Pourquoi l'aiguillage se fait ici ─────────────────────────────────────
 *
 * Savoir s'il y a une session suppose de lire un cookie. Fait depuis la page,
 * cela rend la route dynamique **pour tout le monde** — y compris pour le
 * visiteur anonyme qu'on voulait épargner : la condition détruit ce qu'elle
 * cherche à protéger. Le middleware, lui, lit les cookies sans engager le
 * rendu. C'est le seul endroit où la question ne coûte rien.
 *
 * La réécriture ne change pas l'URL affichée : l'adresse canonique reste celle
 * de la fiche, et rien de nouveau n'est exposé au crawl. Googlebot n'a jamais
 * de cookie de session, donc il ne reçoit jamais que la version statique.
 *
 * ── La détection ──────────────────────────────────────────────────────────
 *
 * On teste la **présence** du cookie, pas sa validité : vérifier une signature
 * ici coûterait la lecture de session qu'on cherche à éviter. Un cookie
 * périmé fait donc rendre la variante dynamique pour rien — sans conséquence,
 * `auth()` y renverra `null` et la page s'affichera comme pour un anonyme.
 * L'inverse, lui, serait un vrai défaut : jamais de contenu personnalisé servi
 * depuis le cache, puisque la branche cacheable ne reçoit aucune session.
 */
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

/** Sous-chemins de la fiche qui ont leur propre route et ne sont pas réécrits. */
const LISTING_SUBROUTES = new Set(["edit", "republier", "moi", "opengraph-image"]);

function personalisedListingRewrite(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/annonce/")) return null;

  // ["", "annonce", id, slug] — exactement la fiche, ni la route de
  // redirection `/annonce/:id`, ni `/annonce/:id/:slug/edit`.
  const parts = pathname.split("/");
  if (parts.length !== 4) return null;
  if (LISTING_SUBROUTES.has(parts[3])) return null;

  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));
  if (!hasSession) return null;

  const url = req.nextUrl.clone();
  url.pathname = `${pathname}/moi`;
  return NextResponse.rewrite(url);
}

export default function middleware(req: NextRequest, ctx: any) {
  const common = commonRouting(req);
  if (common) return common;

  const personalised = personalisedListingRewrite(req);
  if (personalised) return personalised;

  if (needsSession(req.nextUrl.pathname)) {
    return (withSession as any)(req, ctx);
  }

  return withLandingIntent(req, nextWithPathname(req));
}

/**
 * Transmet le chemin demandé aux composants serveur — **uniquement** là où on
 * s'en sert.
 *
 * Une mise en page n'a pas accès à l'URL courante : elle reçoit des enfants
 * déjà résolus. L'administration en a besoin pour vérifier qu'un compte a le
 * droit d'ouvrir le chapitre demandé — masquer un lien dans la barre latérale
 * n'a jamais fermé une porte, l'adresse reste tapable.
 *
 * ── Pourquoi la restriction ───────────────────────────────────────────────
 *
 * `NextResponse.next({ request: { headers } })` ne se contente pas d'ajouter un
 * en-tête : il déclare que la requête servie à la route n'est plus celle qui est
 * arrivée. Next doit donc réexécuter la route à l'origine, et la réponse cesse
 * d'être servie depuis le cache — y compris pour une page prérendue.
 *
 * Cet appel était fait sur **toutes** les requêtes. Mesure du 19/08/2026, après
 * avoir déjà retiré `auth()` du chemin public :
 *
 *     /ville/paris        → ● prérendue au build
 *     réponse servie      → cache-control: private, no-cache, no-store
 *                           x-vercel-cache: MISS
 *
 * Une page statique qui ne se cache pas : la contradiction ne venait pas de
 * NextAuth mais d'ici. `x-pathname` ne sert qu'à `/admin` — le reste du site
 * payait un surcoût pour un en-tête que personne ne lisait.
 *
 * ⚠️ Avant de lire `x-pathname` depuis une nouvelle route, l'ajouter à
 * `PATHNAME_HEADER_PREFIXES`. L'en-tête est absent partout ailleurs, et son
 * absence est silencieuse.
 */
const PATHNAME_HEADER_PREFIXES = ["/admin"];

function nextWithPathname(req: NextRequest): NextResponse {
  if (!PATHNAME_HEADER_PREFIXES.some((p) => req.nextUrl.pathname.startsWith(p))) {
    return NextResponse.next();
  }
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

/**
 * Mémorise l'intention portée par l'arrivée, quand il y en a une.
 *
 * Un `utm_term` sur un lien sponsorisé, un `?q=` sur un lien partagé : c'est le
 * seul moment où l'on sait de quoi la visite parlait avant d'atterrir. Trente
 * jours, trois mots-clés, aucun identifiant — et on n'écrase pas une intention
 * déjà connue par une visite qui n'en porte pas.
 */
function withLandingIntent(req: NextRequest, res: NextResponse): NextResponse {
  const keywords = readLandingIntent(req.nextUrl, req.headers.get("referer"));
  if (keywords.length === 0) return res;

  res.cookies.set(INTENT_COOKIE, encodeIntent(keywords), {
    maxAge: INTENT_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next|api|opengraph-image|.*\\..*).*)" ],
};

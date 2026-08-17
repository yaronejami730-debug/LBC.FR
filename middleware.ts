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

export default auth((req: any) => {
  const { pathname } = req.nextUrl;
  const userAgent = req.headers.get("user-agent") || "";
  const host = req.headers.get("host") || "";

  // Deal&Co Pet is deployed but kept hidden until launch. While PET_PUBLIC is
  // not "true", every pet route and the pet. subdomain render a 404.
  const petEnabled = process.env.PET_PUBLIC === "true";
  const isPetSubdomain = host.startsWith("pet.");
  const isPetPath = pathname === "/pet" || pathname.startsWith("/pet/");
  if (!petEnabled && (isPetSubdomain || isPetPath)) {
    const url = req.nextUrl.clone();
    url.pathname = "/_pet-disabled";
    return NextResponse.rewrite(url);
  }

  // Deal&Co Pet runs on the `pet.` subdomain. Rewrite root requests onto the
  // /pet/* segment so the same Next.js app serves both universes from one
  // deployment. Skips assets, API routes, and paths that already start with
  // /pet to avoid recursive rewrites.
  if (isPetSubdomain && !pathname.startsWith("/pet") && !pathname.startsWith("/api") && !pathname.startsWith("/_next")) {
    const url = req.nextUrl.clone();
    url.pathname = `/pet${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  // Skip auth entirely for OG image routes — prevents AuthJS cookies
  if (pathname.includes("/opengraph-image")) {
    return NextResponse.next();
  }

  // Skip auth middleware for scrapers — prevents AuthJS cookies
  if (isScraperBot(userAgent)) {
    const response = NextResponse.next();
    // Override cache-control for bots — allow caching of public pages
    response.headers.set("cache-control", "public, max-age=3600");
    return response;
  }

  const isLoggedIn = !!req.auth;

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin && pathname !== "/admin/login") {
    if (!isLoggedIn) return NextResponse.redirect(new URL("/admin/login", req.nextUrl.origin));
    const role = (req.auth?.user as any)?.role;
    if (role !== "ADMIN") return NextResponse.redirect(new URL("/admin/login", req.nextUrl.origin));
  }

  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return withLandingIntent(req, NextResponse.next());
});

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

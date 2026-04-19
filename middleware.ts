import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

const PROTECTED = ["/messages", "/profile", "/post", "/favorites"];

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

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next|api|opengraph-image|.*\\..*).*)" ],
};

import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const PROTECTED = ["/messages", "/profile", "/post"];

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;
  const role = (req.auth?.user as unknown as Record<string, unknown> | undefined)?.role as string | undefined;

  // Admin routes: must be logged in AND have ADMIN role
  if (pathname.startsWith("/admin")) {
    // Allow the admin login page through without auth
    if (pathname === "/admin/login") return NextResponse.next();

    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/admin/login", req.nextUrl.origin));
    }
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/admin/login", req.nextUrl.origin));
    }
    return NextResponse.next();
  }

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)" ],
};

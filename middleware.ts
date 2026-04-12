import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const PROTECTED = ["/messages", "/profile", "/post"];

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const role = (req.auth?.user as any)?.role;

  // Admin section logic
  if (pathname.startsWith("/admin")) {
    const isAdminLogin = pathname === "/admin/login";
    
    // If it's the admin login page, let it through
    if (isAdminLogin) return NextResponse.next();

    // Not logged in -> go to admin login
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/admin/login", req.nextUrl.origin));
    }

    // Logged in but not admin -> also go to admin login (where an error message will show)
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/admin/login", req.nextUrl.origin));
    }

    return NextResponse.next();
  }

  // Protected user routes
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

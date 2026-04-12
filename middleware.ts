import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const PROTECTED = ["/messages", "/profile", "/post", "/favorites"];

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  
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
  matcher: ["/((?!_next|api|.*\\..*).*)" ],
};

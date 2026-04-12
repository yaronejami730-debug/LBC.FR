import type { NextAuthConfig } from "next-auth";

// Edge-compatible config — NO Node.js imports (no pg, no Prisma, no bcrypt)
// Used ONLY by middleware to read the JWT cookie and check session existence
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth }) {
      // Let the middleware handler logic in middleware.ts handle protection.
      return true;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (token.role) (session.user as unknown as Record<string, unknown>).role = token.role as string;
      return session;
    },
  },
} satisfies NextAuthConfig;

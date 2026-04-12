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
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;

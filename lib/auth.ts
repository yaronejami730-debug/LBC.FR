import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });
        if (!user) return null;
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!valid) return null;
        // Mettre à jour lastLoginAt — fire and forget
        prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), reengagementSentAt: null } }).catch(() => {});
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id as string },
          select: { role: true },
        });
        token.role = dbUser?.role ?? "USER";
      }
      return token;
    },
    authorized({ auth, request: { nextUrl } }) {
      // The middleware function handles the actual protection logic.
      // We return true here to avoid NextAuth automatically redirecting public pages.
      return true;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (token.role) (session.user as unknown as Record<string, unknown>).role = token.role as string;
      return session;
    },
  },
});

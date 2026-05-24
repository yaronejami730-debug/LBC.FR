import { config } from "dotenv";
config({ path: ".env.local" });
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

(async () => {
  const email = "test@dealandco.local";
  const password = "Test1234!";
  const hashed = await bcrypt.hash(password, 12);
  const u = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      password: hashed,
      name: "Test User",
      memberSince: new Date().getFullYear(),
      emailVerified: true,
      marketingConsent: false,
      consentGivenAt: new Date(),
    },
    update: { password: hashed, emailVerified: true },

  });
  console.log("OK", u.email, u.id);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

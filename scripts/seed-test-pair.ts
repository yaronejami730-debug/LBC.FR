import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

(async () => {
  const accounts = [
    { email: "test@dealandco.local", name: "Test User A" },
    { email: "test2@dealandco.local", name: "Test User B" },
  ];
  const password = "Test1234!";
  const hashed = await bcrypt.hash(password, 12);

  for (const a of accounts) {
    const u = await prisma.user.upsert({
      where: { email: a.email },
      create: {
        email: a.email,
        password: hashed,
        name: a.name,
        memberSince: new Date().getFullYear(),
        emailVerified: true,
        marketingConsent: false,
        consentGivenAt: new Date(),
      },
      update: { password: hashed, emailVerified: true },
    });
    console.log("OK", u.email, u.id);
  }

  // Crée une annonce pour B + une conversation A↔B sur cette annonce
  const userA = await prisma.user.findUnique({ where: { email: accounts[0].email } });
  const userB = await prisma.user.findUnique({ where: { email: accounts[1].email } });
  if (!userA || !userB) throw new Error("users introuvables");

  let listing = await prisma.listing.findFirst({
    where: { userId: userB.id, title: "Annonce test B" },
  });
  if (!listing) {
    listing = await prisma.listing.create({
      data: {
        title: "Annonce test B",
        price: 100,
        category: "Mode",
        description: "Article test pour valider les conversations.",
        location: "Paris 75011",
        condition: "Bon état",
        images: "[]",
        metadata: "{}",
        userId: userB.id,
        status: "APPROVED",
      },
    });
    console.log("listing créé:", listing.id);
  }

  const conv = await prisma.conversation.findFirst({
    where: {
      listingId: listing.id,
      AND: [
        { participants: { some: { userId: userA.id } } },
        { participants: { some: { userId: userB.id } } },
      ],
    },
  });
  if (!conv) {
    const created = await prisma.conversation.create({
      data: {
        listingId: listing.id,
        participants: { create: [{ userId: userA.id }, { userId: userB.id }] },
      },
    });
    console.log("conversation créée:", created.id);
  } else {
    console.log("conversation existante:", conv.id);
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

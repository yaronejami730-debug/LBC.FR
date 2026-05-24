import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { prisma } from "../lib/prisma";

(async () => {
  const jami = await prisma.user.findUnique({ where: { email: "yaronejami730@gmail.com" } });
  const test2 = await prisma.user.findUnique({ where: { email: "test2@dealandco.local" } });
  if (!jami || !test2) throw new Error("users introuvables");

  let listing = await prisma.listing.findFirst({
    where: { userId: test2.id, title: "Annonce pour Jami" },
  });
  if (!listing) {
    listing = await prisma.listing.create({
      data: {
        title: "Annonce pour Jami",
        price: 50,
        category: "Mode",
        description: "Article test pour notif Jami.",
        location: "Paris",
        condition: "Bon état",
        images: "[]",
        metadata: "{}",
        userId: test2.id,
        status: "APPROVED",
      },
    });
    console.log("listing créé:", listing.id);
  }

  let conv = await prisma.conversation.findFirst({
    where: {
      listingId: listing.id,
      AND: [
        { participants: { some: { userId: jami.id } } },
        { participants: { some: { userId: test2.id } } },
      ],
    },
  });
  if (!conv) {
    conv = await prisma.conversation.create({
      data: {
        listingId: listing.id,
        participants: { create: [{ userId: jami.id }, { userId: test2.id }] },
      },
    });
    console.log("conv créée:", conv.id);
  } else {
    console.log("conv existante:", conv.id);
  }
  process.exit(0);
})();

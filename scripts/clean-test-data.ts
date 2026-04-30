import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function cleanTestData() {
  try {
    console.log("🗑️  Suppression de TOUS les vendeurs fictifs et annonces...");

    // D'abord supprimer les annonces
    const deleteListings = await prisma.listing.deleteMany({
      where: {
        user: {
          email: { contains: "seller-" },
        },
      },
    });

    console.log(`✅ ${deleteListings.count} annonces de test supprimées`);

    // Ensuite supprimer les utilisateurs test
    const deleteUsers = await prisma.user.deleteMany({
      where: {
        email: { contains: "seller-" },
      },
    });

    console.log(`✅ ${deleteUsers.count} vendeurs fictifs supprimés`);
    console.log("✨ Base de données nettoyée!");
  } catch (error) {
    console.error("❌ Erreur:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanTestData();

import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function updateAdminEmail() {
  try {
    console.log("🔄 Changement de l'email admin...");

    const admin = await prisma.user.update({
      where: { email: "admin@presdetoi.fr" },
      data: { email: "admin@dealandcompany.fr" },
    });

    console.log(`✅ Email admin changé: ${admin.email}`);
    console.log("✨ Fait!");
  } catch (error) {
    console.error("❌ Erreur:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdminEmail();

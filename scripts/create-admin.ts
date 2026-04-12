/**
 * Script à usage unique — crée ou promeut un compte admin.
 * Usage : npx tsx scripts/create-admin.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const EMAIL    = "admin@presdetoi.fr";
const PASSWORD = "Admin1234!";
const NAME     = "Admin";

async function main() {
  const hashed = await bcrypt.hash(PASSWORD, 12);

  const user = await prisma.user.upsert({
    where:  { email: EMAIL },
    update: { role: "ADMIN", password: hashed },
    create: { email: EMAIL, password: hashed, name: NAME, role: "ADMIN" },
  });

  console.log(`✓ Compte admin prêt : ${user.email}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  try {
    const count = await prisma.user.count();
    console.log("SUCCESS: User count is", count);
  } catch (err) {
    console.error("FAILURE:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();

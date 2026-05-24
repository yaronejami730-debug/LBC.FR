import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { prisma } from "../lib/prisma";

(async () => {
  const email = process.argv[2];
  if (!email) {
    const all = await prisma.user.findMany({ select: { email: true, id: true, name: true } });
    console.log("All users:", all.length);
    for (const u of all) console.log(`  ${u.email} ${u.id} ${u.name}`);
  } else {
    const u = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, emailVerified: true, bannedAt: true },
    });
    console.log(u);
  }
  process.exit(0);
})();

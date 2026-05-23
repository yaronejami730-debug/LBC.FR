import { config } from "dotenv";
config({ path: ".env.local", override: true });
import { prisma } from "../lib/prisma";

(async () => {
  const tokens = await prisma.expoPushToken.findMany({
    include: { user: { select: { email: true } } },
  });
  console.log("ExpoPushToken count:", tokens.length);
  for (const t of tokens) {
    console.log(`  ${t.user.email} ${t.platform} ${t.token.slice(0, 30)}... disabled=${!!t.disabledAt}`);
  }
  process.exit(0);
})();

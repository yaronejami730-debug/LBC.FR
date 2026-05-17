/**
 * Crée une clé API pour un utilisateur. La clé en clair est imprimée UNE FOIS —
 * impossible à récupérer ensuite (seul son hash est stocké).
 *
 *   npx tsx scripts/create-api-key.ts <userId> <name>
 *
 * Exemple :
 *   npx tsx scripts/create-api-key.ts ckxyz123 "Import externe site X"
 */
import "./load-env";
import { prisma } from "../lib/prisma";
import { generateApiKey } from "../lib/api-key-auth";

async function main() {
  const [userId, ...nameParts] = process.argv.slice(2);
  const name = nameParts.join(" ").trim();

  if (!userId || !name) {
    console.error("Usage : tsx scripts/create-api-key.ts <userId> <name>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) {
    console.error(`Utilisateur ${userId} introuvable.`);
    process.exit(1);
  }

  const { raw, prefix, hash } = generateApiKey();
  await prisma.apiKey.create({
    data: { userId: user.id, name, keyHash: hash, keyPrefix: prefix },
  });

  console.log(`\n✓ Clé créée pour ${user.email} (${name})`);
  console.log(`\n  ${raw}\n`);
  console.log("⚠️  Stocke-la maintenant — elle ne sera plus jamais affichée.\n");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

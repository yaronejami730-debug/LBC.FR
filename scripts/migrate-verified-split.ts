/**
 * Migration : sépare « email confirmé » du badge « Vendeur vérifié ».
 *
 * Historique : `verified: true` était mis à la confirmation email — tout
 * compte ayant confirmé son adresse héritait du badge « Vendeur vérifié »
 * de façon automatique, alors qu'il devrait être réservé à une validation
 * admin.
 *
 * Action :
 *   - tous les `verified: true` actuels → `emailVerified: true`
 *     (ils ont bien confirmé leur email)
 *   - `verified: false` pour tous (aucune promotion admin n'avait été faite)
 *
 * Usage :
 *   npm run users:migrate-verified           → DRY-RUN (compte seul)
 *   npm run users:migrate-verified -- --apply → applique en base
 *
 * Si une vraie promotion admin existait, ré-attribuer manuellement via
 * l'interface admin après migration.
 */
import "./load-env";
import { prisma } from "../lib/prisma";

const APPLY = process.argv.includes("--apply");

async function main() {
  const candidates = await prisma.user.findMany({
    where: { verified: true },
    select: { id: true, email: true, emailVerified: true },
  });

  console.log(`${candidates.length} utilisateur(s) avec verified=true.`);
  candidates.forEach((u) =>
    console.log(`  ${u.email}  (emailVerified actuel: ${u.emailVerified})`),
  );

  if (!APPLY) {
    console.log("\n— DRY-RUN — rien n'a été écrit. Ajouter « -- --apply » pour migrer.");
    process.exit(0);
  }

  const res = await prisma.user.updateMany({
    where: { verified: true },
    data: { verified: false, emailVerified: true },
  });
  console.log(`\n✓ Migration appliquée : ${res.count} ligne(s) mise(s) à jour.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Échec migration:", err);
  process.exit(1);
});

/**
 * Crée un compte annonceur de test et affiche ses accès.
 *
 * Passe par `createAdvertiser`, le même chemin que l'administration : même
 * génération d'identifiant, même hachage, même `mustChangePassword`. Un compte
 * fabriqué à la main avec un `INSERT` ne prouverait rien du parcours réel.
 *
 * L'adresse par défaut est en `.local`, comme les autres comptes de test du
 * projet — elle n'atteindra jamais une vraie boîte. À savoir tout de même :
 * Brevo accepte l'appel d'API sans vérifier le domaine, l'envoi est donc
 * compté et se soldera par un rebond dur. Un rebond isolé ne pèse rien, mais
 * ne bouclez pas ce script : les rebonds abîment la réputation d'expéditeur,
 * et le domaine n'a aujourd'hui ni SPF ni DKIM pour l'amortir.
 *
 *     npx tsx -r ./scripts/load-env.ts scripts/seed-advertiser-test.ts
 *     npx tsx -r ./scripts/load-env.ts scripts/seed-advertiser-test.ts --email=moi@exemple.fr
 *     npx tsx -r ./scripts/load-env.ts scripts/seed-advertiser-test.ts --solde=5000
 *     npx tsx -r ./scripts/load-env.ts scripts/seed-advertiser-test.ts --supprimer
 */

import { prisma } from "../lib/prisma";
import { createAdvertiser, advertiserLoginUrl } from "../lib/ads/advertiser-admin";

const DEFAULT_EMAIL = "annonceur-test@dealandco.local";

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

async function main() {
  const email = (arg("email") ?? DEFAULT_EMAIL).toLowerCase();

  if (process.argv.includes("--supprimer")) {
    const { count } = await prisma.advertiser.deleteMany({ where: { email } });
    console.log(count ? `Compte ${email} supprimé.` : `Aucun compte ${email}.`);
    return;
  }

  // Rejouable : on efface l'éventuel compte précédent plutôt que de buter sur
  // la contrainte d'unicité de l'e-mail.
  const existing = await prisma.advertiser.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    await prisma.advertiser.delete({ where: { id: existing.id } });
    console.log(`Ancien compte ${email} remplacé.\n`);
  }

  const { advertiser, loginId, password, sent } = await createAdvertiser({
    firstName: "Camille",
    lastName: "Testeur",
    email,
    phone: "0600000000",
    company: "Boulangerie du Marais",
    siret: "12345678900012",
    addressLine: "12 rue des Rosiers",
    city: "Paris",
    postalCode: "75004",
  });

  // Solde prépayé : sans crédit, aucune diffusion n'est possible et l'espace
  // annonceur n'a rien à montrer. 50 € par défaut.
  const balanceCents = Number(arg("solde") ?? 5000);
  if (Number.isFinite(balanceCents) && balanceCents > 0) {
    await prisma.advertiser.update({
      where: { id: advertiser.id },
      data: { balanceCents },
    });
  }

  console.log("Compte annonceur de test créé\n");
  console.log(`  Enseigne      ${advertiser.company}`);
  console.log(`  Contact       ${advertiser.firstName} ${advertiser.lastName}`);
  console.log(`  E-mail        ${advertiser.email}`);
  console.log(`  Identifiant   ${loginId}`);
  console.log(`  Mot de passe  ${password}`);
  console.log(`  Solde         ${(balanceCents / 100).toFixed(2)} €`);
  console.log(`  Connexion     ${advertiserLoginUrl()}`);
  console.log(`\n  E-mail d'accès : ${sent ? "envoyé" : "non envoyé (adresse de test)"}`);
  console.log("  Changement de mot de passe demandé à la première connexion.");
  console.log("\n  Suppression : npm run seed:advertiser -- --supprimer");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/**
 * Relance par email les utilisateurs n'ayant pas accepté les CGU
 * ni la politique de confidentialité.
 *
 *   npm run users:consent-reminder           → DRY-RUN (compte + liste, aucun envoi)
 *   npm run users:consent-reminder -- --send  → envoie réellement les emails
 *
 * Cible :
 *   - consentGivenAt = null   → CGU/confidentialité non acceptées
 *   - bannedAt = null         → exclut les comptes bannis
 *   - hors comptes de test / internes (yaronejami*, test@, admin*)
 */
import "./load-env";
import { prisma } from "../lib/prisma";
import { sendEmail } from "../lib/email";
import { createEmailPrefToken } from "../lib/email-token";
import { consentReminderEmail } from "../lib/emails/consent-reminder";

const SEND = process.argv.includes("--send");
const BASE_URL = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
const SUBJECT = "Action requise : acceptez nos CGU et notre politique de confidentialité";

// Comptes de test / internes exclus de la relance.
const TEST_PATTERNS = [/yaronejami/i, /^test@/i, /^admin[@+]/i];
const isTestAccount = (email: string) => TEST_PATTERNS.some((re) => re.test(email));

async function main() {
  const all = await prisma.user.findMany({
    where: {
      consentGivenAt: null,
      bannedAt: null,
    },
    select: { id: true, name: true, email: true },
  });

  const users = all.filter((u) => !isTestAccount(u.email));
  const excluded = all.length - users.length;

  console.log(
    `${users.length} utilisateur(s) ciblé(s) — CGU non acceptées, non banni ` +
      `(${excluded} compte(s) de test exclu(s)).`,
  );

  if (!SEND) {
    console.log("\n— DRY-RUN — aucun email envoyé. Ajouter « -- --send » pour envoyer.\n");
    users.slice(0, 25).forEach((u) => console.log(`  ${u.email}  (${u.name})`));
    if (users.length > 25) console.log(`  … +${users.length - 25} autre(s)`);
    process.exit(0);
  }

  let ok = 0;
  let fail = 0;
  for (const u of users) {
    const acceptUrl = `${BASE_URL}/accepter-cgu?token=${createEmailPrefToken(u.id)}`;
    try {
      await sendEmail({
        to: u.email,
        toName: u.name,
        subject: SUBJECT,
        html: consentReminderEmail({ name: u.name, acceptUrl }),
        adSource: "admin-consent-reminder", // préfixe "admin" → pas de pub
        userId: u.id,
      });
      ok++;
      console.log(`  ✓ ${u.email}`);
    } catch (err) {
      fail++;
      console.error(`  ✗ ${u.email}: ${err instanceof Error ? err.message : err}`);
    }
    await new Promise((r) => setTimeout(r, 250)); // throttle Brevo
  }

  console.log(`\n✓ ${ok} envoyé(s)  ✗ ${fail} échec(s).`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Échec:", err);
  process.exit(1);
});

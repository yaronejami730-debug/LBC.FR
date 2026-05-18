/**
 * Envoie les emails de démarchage (agence + particulier) à une adresse de test.
 *   npx tsx scripts/send-test-pitch.ts <email>
 */
import "./load-env";
import { sendEmail } from "../lib/email";
import { agencyPitchEmail } from "../lib/emails/agency-pitch";
import { particulierPitchEmail } from "../lib/emails/particulier-pitch";

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error("Usage : tsx scripts/send-test-pitch.ts <email>");
    process.exit(1);
  }
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";

  const agency = agencyPitchEmail({ agencyName: "Agence Test", baseUrl });
  await sendEmail({
    to,
    subject: `[TEST] ${agency.subject}`,
    html: agency.html,
    adSource: "admin-agency-pitch",
  });
  console.log(`✓ Pitch agence envoyé à ${to}`);

  const part = particulierPitchEmail({ baseUrl });
  await sendEmail({
    to,
    subject: `[TEST] ${part.subject}`,
    html: part.html,
    adSource: "admin-particulier-pitch",
  });
  console.log(`✓ Pitch particulier envoyé à ${to}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

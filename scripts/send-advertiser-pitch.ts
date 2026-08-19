/**
 * Envoi manuel d'une proposition de campagne publicitaire à un prospect.
 *
 * Usage :
 *   npx tsx -r ./scripts/load-env.ts scripts/send-advertiser-pitch.ts \
 *     --to <email> --prenom <prénom> [--enseigne <nom>] [--budget 25] [--url <base>]
 */
import { sendEmail } from "@/lib/email";
import { advertiserPitchEmail } from "@/lib/emails/advertiser-pitch";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const to = arg("to");
  const firstName = arg("prenom");
  const companyName = arg("enseigne");
  const dailyBudgetEuros = Number(arg("budget", "25"));
  if (!to || !firstName) throw new Error("--to et --prenom sont obligatoires");

  // Jamais `NEXT_PUBLIC_APP_URL` : en local il vaut http://localhost:3000, et le
  // bouton du mail n'ouvrirait rien chez le destinataire.
  const baseUrl = arg("url", "https://www.dealandcompany.fr")!;
  const { subject, html } = advertiserPitchEmail({ firstName, companyName, dailyBudgetEuros, baseUrl });

  await sendEmail({ to, toName: firstName, subject, html, adSource: "advertiser_pitch" });
  console.log(`✔ Envoyé à ${to} — « ${subject} »`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

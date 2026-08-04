import { baseEmail } from "./base";
import { BUDGET_LABELS, type AdvertiserBudget } from "@/lib/advertiser-budgets";

/** Notification interne : un annonceur vient de demander à être rappelé. */
export function advertiserLeadAdminEmail({
  firstName,
  lastName,
  email,
  phone,
  budget,
  company,
  message,
  source,
  adminUrl,
}: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  budget: AdvertiserBudget;
  company?: string | null;
  message?: string | null;
  source?: string | null;
  adminUrl: string;
}): string {
  const row = (label: string, value: string) =>
    `<p style="font-size:13px;color:#424751;margin:0 0 4px;">${label} : <strong>${value}</strong></p>`;

  return baseEmail({
    title: "Nouvelle demande annonceur — Deal & Co",
    heading: "📣 Nouvelle demande annonceur",
    body: `
      <p style="margin:0 0 16px;">Un annonceur souhaite être rappelé sous 24 à 48 h.</p>
      <div style="background:#eef4fb;border-left:3px solid #2f6fb8;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 16px;text-align:left;">
        <p style="font-size:15px;color:#1a1b25;font-weight:700;margin:0 0 8px;">${firstName} ${lastName}</p>
        ${company ? row("Société", company) : ""}
        ${row("Téléphone", phone)}
        ${row("Email", email)}
        ${row("Budget", BUDGET_LABELS[budget])}
        ${source ? row("Origine", source) : ""}
      </div>
      ${
        message
          ? `<div style="background:#f8fafc;border-radius:8px;padding:14px 18px;margin:0 0 16px;text-align:left;">
               <p style="font-size:13px;color:#424751;margin:0;font-style:italic;">« ${message} »</p>
             </div>`
          : ""
      }
      <p style="margin:0;">Rappelez-le au <strong>${phone}</strong>, puis passez la demande en « Contacté » dans l'administration.</p>
    `,
    ctaLabel: "Ouvrir la demande",
    ctaUrl: adminUrl,
  });
}

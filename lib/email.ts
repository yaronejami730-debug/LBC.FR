const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const FROM_EMAIL = "notif@dealandcompany.fr";
const FROM_NAME = "Deal & Co";

export async function sendEmail({
  to,
  toName,
  subject,
  html,
}: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
}) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: to, name: toName ?? to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo error: ${err}`);
  }

  return res.json();
}

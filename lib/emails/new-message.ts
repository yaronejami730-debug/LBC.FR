import { baseEmail } from "./base";

export function newMessageEmail({
  name,
  senderName,
  listingTitle,
  messageBody,
  conversationUrl,
}: {
  name: string;
  senderName: string;
  listingTitle: string;
  messageBody: string;
  conversationUrl: string;
}): string {
  return baseEmail({
    title: `Nouveau message de ${senderName} — Deal & Co`,
    heading: "Vous avez reçu un message",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
      <p style="margin:0 0 24px;"><strong style="color:#1a1b25;">${senderName}</strong> vous a envoyé un message concernant votre annonce <strong style="color:#1a1b25;">« ${listingTitle} »</strong>.</p>
      <div style="background:#f5f2ff;border-left:3px solid #2f6fb8;border-radius:0 8px 8px 0;padding:16px 20px;margin:0;text-align:left;">
        <p style="font-size:14px;color:#424751;line-height:1.7;margin:0;font-style:italic;">« ${messageBody} »</p>
      </div>
    `,
    ctaLabel: "Répondre au message",
    ctaUrl: conversationUrl,
    postCta:
      "Vous pouvez gérer vos notifications dans les paramètres de votre compte sur dealandcompany.fr.",
  });
}

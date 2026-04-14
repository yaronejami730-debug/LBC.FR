import { baseEmail } from "./base";

export function listingRejectedEmail({
  name,
  listingTitle,
  reason,
  postUrl,
}: {
  name: string;
  listingTitle: string;
  reason?: string;
  postUrl: string;
}): string {
  return baseEmail({
    title: "Votre annonce n'a pas été publiée — Deal & Co",
    heading: "Votre annonce nécessite des modifications",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
      <p style="margin:0 0 16px;">Nous n'avons pas pu publier votre annonce <strong style="color:#1a1b25;">« ${listingTitle} »</strong> car elle ne respecte pas nos conditions de publication.</p>
      ${reason ? `<div style="background:#f5f2ff;border-left:3px solid #2f6fb8;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 16px;text-align:left;"><p style="font-size:14px;color:#424751;line-height:1.7;margin:0;">Motif : ${reason}</p></div>` : ""}
      <p style="margin:0;">Corrigez votre annonce et soumettez-la à nouveau — notre équipe la revalidera dans les plus brefs délais.</p>
    `,
    ctaLabel: "Modifier mon annonce",
    ctaUrl: postUrl,
    postCta:
      "Si vous pensez qu'il s'agit d'une erreur, contactez-nous sur dealandcompany.fr.",
  });
}

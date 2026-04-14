import { baseEmail } from "./base";

export function listingExpiringEmail({
  name,
  listingTitle,
  daysLeft,
  renewUrl,
}: {
  name: string;
  listingTitle: string;
  daysLeft: number;
  renewUrl: string;
}): string {
  return baseEmail({
    title: "Votre annonce expire bientôt — Deal & Co",
    heading: "Votre annonce expire dans\u00a0" + daysLeft + "\u00a0jour" + (daysLeft > 1 ? "s" : ""),
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
      <p style="margin:0 0 16px;">Votre annonce <strong style="color:#1a1b25;">« ${listingTitle} »</strong> sera automatiquement retirée dans <strong style="color:#1a1b25;">${daysLeft} jour${daysLeft > 1 ? "s" : ""}</strong>.</p>
      <p style="margin:0;">Si vous souhaitez la garder en ligne, renouvelez-la dès maintenant en un clic.</p>
    `,
    ctaLabel: "Renouveler mon annonce",
    ctaUrl: renewUrl,
    postCta:
      "Si votre article est vendu, vous pouvez simplement ignorer cet email et laisser l'annonce expirer.",
  });
}

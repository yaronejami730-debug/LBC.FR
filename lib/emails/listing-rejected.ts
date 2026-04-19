import { baseEmail } from "./base";

export function listingRejectedEmail({
  name,
  listingTitle,
  reason,
  postUrl,
  isProActivity,
  proUpgradeUrl,
}: {
  name: string;
  listingTitle: string;
  reason?: string;
  postUrl: string;
  isProActivity?: boolean;
  proUpgradeUrl?: string;
}): string {
  if (isProActivity) {
    return baseEmail({
      title: "Votre annonce n'a pas été publiée — Deal & Co",
      heading: "Cette annonce relève d'une activité professionnelle",
      body: `
        <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
        <p style="margin:0 0 16px;">Votre annonce <strong style="color:#1a1b25;">« ${listingTitle} »</strong> semble correspondre à une activité professionnelle (prestations, services réguliers, vocabulaire pro, volume de publications, etc.).</p>
        <p style="margin:0 0 16px;">La publication depuis un compte particulier n'est pas autorisée dans ce cas. Pour garantir la transparence vis-à-vis des acheteurs et le respect de la réglementation française, ce type d'annonce doit être publié depuis un <strong style="color:#1a1b25;">compte professionnel</strong>.</p>
        ${reason ? `<div style="background:#f5f2ff;border-left:3px solid #2f6fb8;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 16px;text-align:left;"><p style="font-size:14px;color:#424751;line-height:1.7;margin:0;">${reason}</p></div>` : ""}
        <p style="margin:0;">Passez votre compte en professionnel en quelques minutes, puis republiez votre annonce.</p>
      `,
      ctaLabel: "Passer en compte pro",
      ctaUrl: proUpgradeUrl ?? postUrl,
      postCta:
        "Si votre annonce concerne une vente ponctuelle de particulier à particulier, modifiez-la pour retirer les mentions professionnelles et soumettez-la à nouveau.",
    });
  }

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

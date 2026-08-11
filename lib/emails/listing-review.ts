import { baseEmail } from "./base";

/**
 * Mise en revue d'une annonce en ligne.
 *
 * Ce n'est pas un retrait de modération et l'e-mail ne doit pas en avoir le
 * ton : personne n'est sanctionné, on demande une correction. D'où deux
 * exigences de rédaction :
 *
 *  - le motif écrit par l'équipe est repris tel quel et mis en évidence, car
 *    c'est la seule chose que l'auteur doit lire pour agir ;
 *  - aucune date limite n'est annoncée, il n'y en a pas. Une annonce en revue
 *    n'est pas en sursis.
 */
export function listingUnderReviewEmail({
  name,
  listingTitle,
  reason,
  editUrl,
}: {
  /** Prénom ou raison sociale, tel qu'affiché sur le compte. */
  name: string;
  listingTitle: string;
  /** Motif rédigé par l'équipe, mot pour mot. */
  reason: string;
  editUrl: string;
}): string {
  return baseEmail({
    title: "Votre annonce demande une correction — Deal&Co",
    heading: "Une correction est nécessaire",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
      <p style="margin:0 0 16px;">
        Votre annonce <strong style="color:#1a1b25;">${listingTitle}</strong> a été mise en pause le
        temps d'une correction. Elle n'est plus visible sur Deal&amp;Co pour le moment.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="background:#fff8e6;border-radius:14px;margin:0 0 20px;">
        <tr><td style="padding:18px 20px;font-size:15px;color:#5c4600;line-height:1.7;">
          <strong style="display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8a6d00;margin-bottom:6px;">
            Ce qui est à corriger
          </strong>
          ${reason}
        </td></tr>
      </table>
      <p style="margin:0 0 16px;">
        Modifiez votre annonce et elle repartira automatiquement en validation. Aucune suppression
        n'est programmée : elle vous attend.
      </p>
    `,
    ctaLabel: "Modifier mon annonce",
    ctaUrl: editUrl,
    postCta:
      "Une annonce modifiée repasse par la modération : elle n'est pas remise en ligne " +
      "automatiquement, comptez quelques heures.",
  });
}

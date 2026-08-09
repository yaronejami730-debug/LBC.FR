import { baseEmail } from "./base";

/**
 * Annonce retirée par la modération.
 *
 * Un retrait n'est jamais silencieux : la personne doit savoir ce qui a été
 * retiré, pourquoi, jusqu'à quand elle peut corriger, et où cliquer. Sans
 * date limite explicite, la suppression définitive au bout du délai passerait
 * pour une perte de données.
 */
export function listingRemovedEmail({
  name,
  listingTitle,
  reason,
  deadline,
  editUrl,
  canEdit = true,
}: {
  name: string;
  listingTitle: string;
  reason?: string | null;
  /** Date de suppression définitive, déjà formatée (JJ/MM/AAAA). */
  deadline: string;
  editUrl: string;
  canEdit?: boolean;
}): string {
  const reasonBlock = reason
    ? `<div style="background:#fff5f5;border-left:3px solid #e11d48;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 16px;text-align:left;">
         <p style="font-size:13px;color:#9f1239;font-weight:700;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.5px;">Motif du retrait</p>
         <p style="font-size:14px;color:#424751;line-height:1.7;margin:0;">${reason}</p>
       </div>`
    : "";

  if (!canEdit) {
    return baseEmail({
      title: "Votre annonce a été retirée de Deal&Co",
      heading: "Votre annonce a été retirée",
      body: `
        <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
        <p style="margin:0 0 16px;">Votre annonce <strong style="color:#1a1b25;">« ${listingTitle} »</strong> a été retirée de Deal&Co par notre équipe de modération. Elle n'est plus visible publiquement.</p>
        ${reasonBlock}
        <p style="margin:0;">Cette annonce ne peut pas être remise en ligne. Elle sera définitivement supprimée le <strong style="color:#1a1b25;">${deadline}</strong>.</p>
      `,
      ctaLabel: "Accéder à mes annonces",
      ctaUrl: editUrl,
      postCta:
        "Si vous pensez qu'il s'agit d'une erreur, répondez à cet email en précisant le titre de l'annonce.",
    });
  }

  return baseEmail({
    title: "Votre annonce a été retirée de Deal&Co",
    heading: "Votre annonce a été retirée",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
      <p style="margin:0 0 16px;">Votre annonce <strong style="color:#1a1b25;">« ${listingTitle} »</strong> a été retirée de Deal&Co par notre équipe de modération. Elle n'apparaît plus dans les recherches ni sur votre profil public.</p>
      ${reasonBlock}
      <p style="margin:0 0 16px;">Elle reste accessible depuis votre espace personnel : vous pouvez la <strong style="color:#1a1b25;">modifier et la soumettre à nouveau</strong> à la validation.</p>
      <div style="background:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 16px;text-align:left;">
        <p style="font-size:14px;color:#424751;line-height:1.7;margin:0;">Vous avez jusqu'au <strong style="color:#1a1b25;">${deadline}</strong> pour la modifier. Passé cette date, l'annonce et ses photos seront définitivement supprimées.</p>
      </div>
      <p style="margin:0;">Une annonce modifiée repasse par la modération : elle n'est pas remise en ligne automatiquement.</p>
    `,
    ctaLabel: "Modifier mon annonce",
    ctaUrl: editUrl,
    postCta:
      "Si vous pensez qu'il s'agit d'une erreur, répondez à cet email en précisant le titre de l'annonce.",
  });
}

/** Annonce validée après correction : elle est de nouveau visible. */
export function listingRestoredEmail({
  name,
  listingTitle,
  listingUrl,
}: {
  name: string;
  listingTitle: string;
  listingUrl: string;
}): string {
  return baseEmail({
    title: "Votre annonce est de nouveau en ligne — Deal&Co",
    heading: "Votre annonce a été approuvée",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
      <p style="margin:0 0 16px;">Votre annonce <strong style="color:#1a1b25;">« ${listingTitle} »</strong> a été approuvée et est de nouveau visible sur Deal&Co.</p>
      <p style="margin:0;">Elle réapparaît dans les recherches, dans sa catégorie et sur votre profil.</p>
    `,
    ctaLabel: "Voir mon annonce",
    ctaUrl: listingUrl,
  });
}

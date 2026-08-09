import { baseEmail } from "./base";

/** Accusé de réception : le dossier part en examen, le compte n'est pas encore pro. */
export function proVerificationSubmittedEmail({
  name,
  companyName,
}: {
  name: string;
  companyName: string;
}): string {
  return baseEmail({
    title: "Demande de compte professionnel reçue — Deal & Co",
    heading: "Votre dossier est en cours d'examen",
    body: `
      <p style="margin:0 0 16px;">Bonjour ${name || ""},</p>
      <p style="margin:0 0 16px;">Nous avons bien reçu votre demande de compte professionnel pour <strong>${companyName}</strong>, ainsi que vos justificatifs.</p>
      <p style="margin:0 0 16px;">Un modérateur les vérifie sous 24 à 48 heures ouvrées. Votre compte passera en professionnel une fois le dossier validé — vous recevrez un email à ce moment-là.</p>
      <p style="margin:0 0 16px;">Cette vérification protège les professionnels déjà présents : elle empêche l'utilisation d'un numéro SIRET qui ne vous appartiendrait pas.</p>
      <p style="margin:0;">L'équipe Deal&nbsp;&amp;&nbsp;Co</p>
    `,
    ctaLabel: "Voir mon profil",
    ctaUrl: "https://www.dealandcompany.fr/profile",
  });
}

/** Le dossier est validé : le compte est passé professionnel. */
export function proVerificationApprovedEmail({
  name,
  companyName,
}: {
  name: string;
  companyName: string;
}): string {
  return baseEmail({
    title: "Votre compte professionnel est activé — Deal & Co",
    heading: "Compte professionnel activé",
    body: `
      <p style="margin:0 0 16px;">Bonjour ${name || ""},</p>
      <p style="margin:0 0 16px;">Vos justificatifs ont été vérifiés : <strong>${companyName}</strong> est désormais un compte professionnel vérifié sur Deal&nbsp;&amp;&nbsp;Co.</p>
      <p style="margin:0 0 16px;">Vos annonces affichent le badge professionnel et vous pouvez publier vos prestations dans les rubriques réservées aux pros.</p>
      <p style="margin:0;">L'équipe Deal&nbsp;&amp;&nbsp;Co</p>
    `,
    ctaLabel: "Publier une annonce",
    ctaUrl: "https://www.dealandcompany.fr/post",
  });
}

/** Le dossier est refusé : motif explicite, nouveau dépôt possible. */
export function proVerificationRejectedEmail({
  name,
  reason,
}: {
  name: string;
  reason: string;
}): string {
  return baseEmail({
    title: "Votre demande de compte professionnel — Deal & Co",
    heading: "Dossier non validé",
    body: `
      <p style="margin:0 0 16px;">Bonjour ${name || ""},</p>
      <p style="margin:0 0 16px;">Votre demande de compte professionnel n'a pas pu être validée pour la raison suivante :</p>
      <p style="margin:0 0 16px;padding:12px 16px;background:#f7f9fb;border-radius:8px;"><strong>${reason}</strong></p>
      <p style="margin:0 0 16px;">Vous pouvez déposer un nouveau dossier depuis votre profil avec des justificatifs à jour et lisibles.</p>
      <p style="margin:0;">L'équipe Deal&nbsp;&amp;&nbsp;Co</p>
    `,
    ctaLabel: "Déposer un nouveau dossier",
    ctaUrl: "https://www.dealandcompany.fr/profile",
  });
}

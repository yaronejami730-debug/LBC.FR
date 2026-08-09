import { baseEmail } from "./base";

/** Accusé de réception : le compte part en examen, le compte n'est pas encore pro. */
export function proVerificationSubmittedEmail({
  name,
  companyName,
}: {
  name: string;
  companyName: string;
}): string {
  return baseEmail({
    title: "Demande de compte professionnel reçue — Deal & Co",
    heading: "Votre compte professionnel est en cours de vérification",
    body: `
      <p style="margin:0 0 16px;">Bonjour ${name || ""},</p>
      <p style="margin:0 0 16px;">Nous avons bien reçu votre demande de compte professionnel pour <strong>${companyName}</strong>, ainsi que vos justificatifs.</p>
      <p style="margin:0 0 16px;">Un modérateur les vérifie sous 24 à 48 heures ouvrées. Votre compte passera en professionnel une fois le compte validé — vous recevrez un email à ce moment-là.</p>
      <p style="margin:0 0 16px;">Cette vérification protège les professionnels déjà présents : elle empêche l'utilisation d'un numéro SIRET qui ne vous appartiendrait pas.</p>
      <p style="margin:0 0 16px;color:#777683;font-size:13px;">Vos justificatifs ne sont visibles d'aucun utilisateur. Ils servent uniquement à la modération et sont supprimés dès la validation de votre compte ; en cas de refus, ils sont effacés au plus tard 14 mois après le dépôt.</p>
      <p style="margin:0;">L'équipe Deal&nbsp;&amp;&nbsp;Co</p>
    `,
    ctaLabel: "Voir mon profil",
    ctaUrl: "https://www.dealandcompany.fr/profile",
  });
}

/**
 * Compte professionnel approuvé.
 *
 * L'email dit deux choses : c'est accepté, et les pièces d'identité ont été
 * détruites. La seconde compte autant que la première — un professionnel qui
 * confie sa carte d'identité doit savoir ce qu'elle est devenue.
 */
export function proVerificationApprovedEmail({
  name,
  companyName,
}: {
  name: string;
  companyName: string;
}): string {
  return baseEmail({
    title: "Votre compte professionnel est approuvé — Deal & Co",
    heading: "Félicitations, votre compte professionnel est approuvé",
    body: `
      <p style="margin:0 0 16px;">Bonjour ${name || ""},</p>
      <p style="margin:0 0 16px;">Votre compte est désormais un <strong>compte professionnel vérifié</strong> sur Deal&nbsp;&amp;&nbsp;Co, au nom de <strong>${companyName}</strong>.</p>
      <p style="margin:0 0 16px;">Vos annonces affichent le badge professionnel vérifié, et vous pouvez créer votre fiche d'établissement avec votre carte complète de prestations et vos tarifs.</p>
      <p style="margin:0 0 8px;font-weight:700;">Vos documents ont été supprimés</p>
      <p style="margin:0 0 16px;">La vérification étant faite, <strong>votre pièce d'identité et votre justificatif d'entreprise ont été définitivement supprimés de notre base de données et de nos serveurs de stockage.</strong> Nous ne conservons aucune copie.</p>
      <p style="margin:0 0 16px;color:#777683;font-size:13px;">Conformément au RGPD, ces documents n'ont été consultés que par notre équipe de modération, pour le seul motif de vérifier que le numéro SIRET déclaré vous appartient. Ils n'ont jamais été visibles des autres utilisateurs, ne sont apparus ni sur votre profil ni sur vos annonces, et n'ont été transmis à personne. Seuls demeurent le type de document présenté et la date de la décision, nécessaires à la traçabilité de la modération.</p>
      <p style="margin:0;">Bienvenue parmi les professionnels vérifiés,<br/>L'équipe Deal&nbsp;&amp;&nbsp;Co</p>
    `,
    ctaLabel: "Créer ma fiche professionnelle",
    ctaUrl: "https://www.dealandcompany.fr/profile/espace-pro",
  });
}

/** Le compte est refusé : motif explicite, nouveau dépôt possible. */
export function proVerificationRejectedEmail({
  name,
  reason,
}: {
  name: string;
  reason: string;
}): string {
  return baseEmail({
    title: "Votre demande de compte professionnel — Deal & Co",
    heading: "Compte professionnel non validé",
    body: `
      <p style="margin:0 0 16px;">Bonjour ${name || ""},</p>
      <p style="margin:0 0 16px;">Votre demande de compte professionnel n'a pas pu être validée pour la raison suivante :</p>
      <p style="margin:0 0 16px;padding:12px 16px;background:#f7f9fb;border-radius:8px;"><strong>${reason}</strong></p>
      <p style="margin:0 0 16px;">Vous pouvez renvoyer une demande depuis votre profil avec des justificatifs à jour et lisibles.</p>
      <p style="margin:0;">L'équipe Deal&nbsp;&amp;&nbsp;Co</p>
    `,
    ctaLabel: "Renvoyer ma demande",
    ctaUrl: "https://www.dealandcompany.fr/profile",
  });
}

/** Le modérateur demande une pièce ou une précision : la demande reste ouverte. */
export function proVerificationInfoRequestedEmail({
  name,
  request,
}: {
  name: string;
  request: string;
}): string {
  return baseEmail({
    title: "Informations complémentaires — Deal & Co",
    heading: "Une précision est nécessaire",
    body: `
      <p style="margin:0 0 16px;">Bonjour ${name || ""},</p>
      <p style="margin:0 0 16px;">Notre équipe a besoin d'un complément pour valider votre compte professionnel :</p>
      <p style="margin:0 0 16px;padding:12px 16px;background:#f7f9fb;border-radius:8px;"><strong>${request}</strong></p>
      <p style="margin:0 0 16px;">Votre demande reste ouverte : répondez à cet email ou déposez la pièce demandée depuis votre profil, et l'examen reprend.</p>
      <p style="margin:0;">L'équipe Deal&nbsp;&amp;&nbsp;Co</p>
    `,
    ctaLabel: "Compléter mon compte professionnel",
    ctaUrl: "https://www.dealandcompany.fr/profile",
  });
}

/** L'habilitation est suspendue : le compte reste, la fiche publique tombe. */
export function proVerificationSuspendedEmail({
  name,
  reason,
}: {
  name: string;
  reason: string;
}): string {
  return baseEmail({
    title: "Compte professionnel suspendu — Deal & Co",
    heading: "Habilitation professionnelle suspendue",
    body: `
      <p style="margin:0 0 16px;">Bonjour ${name || ""},</p>
      <p style="margin:0 0 16px;">Votre habilitation professionnelle est suspendue pour le motif suivant :</p>
      <p style="margin:0 0 16px;padding:12px 16px;background:#f7f9fb;border-radius:8px;"><strong>${reason}</strong></p>
      <p style="margin:0 0 16px;">Votre compte et vos annonces restent en ligne, mais votre fiche professionnelle n'est plus publique et le badge est retiré. Répondez à cet email pour contester ou régulariser.</p>
      <p style="margin:0;">L'équipe Deal&nbsp;&amp;&nbsp;Co</p>
    `,
    ctaLabel: "Contacter l'équipe",
    ctaUrl: "https://www.dealandcompany.fr/contact",
  });
}

/**
 * Les pièces d'un compte resté sans suite ont été effacées.
 *
 * L'email ne reproche rien : il dit ce qui a été supprimé, pourquoi, et ce
 * qu'il faut refaire pour obtenir l'habilitation.
 */
export function proDocumentsPurgedEmail({
  name,
  months,
}: {
  name: string;
  months: number;
}): string {
  return baseEmail({
    title: "Vos justificatifs ont été supprimés — Deal & Co",
    heading: "Justificatifs supprimés de nos serveurs",
    body: `
      <p style="margin:0 0 16px;">Bonjour ${name || ""},</p>
      <p style="margin:0 0 16px;">Votre demande de compte professionnel est restée sans suite depuis ${months} mois. Conformément à notre durée de conservation, <strong>les justificatifs que vous aviez déposés (pièce d'identité et justificatif d'entreprise) ont été définitivement supprimés de nos serveurs.</strong></p>
      <p style="margin:0 0 16px;">Votre compte, lui, n'a pas changé : vous continuez à publier et à échanger normalement.</p>
      <p style="margin:0 0 16px;">Si vous souhaitez toujours activer votre compte professionnel, mettez à jour vos informations d'entreprise depuis votre profil, puis <strong>déposez à nouveau vos justificatifs</strong> : un modérateur reprendra le compte sous 24 à 48 heures ouvrées.</p>
      <p style="margin:0;">L'équipe Deal&nbsp;&amp;&nbsp;Co</p>
    `,
    ctaLabel: "Mettre à jour mon compte professionnel",
    ctaUrl: "https://www.dealandcompany.fr/profile",
  });
}

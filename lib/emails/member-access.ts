import { baseEmail } from "./base";

/**
 * Remise des accès au planning à un membre d'équipe.
 *
 * Le mot de passe transite en clair dans cet e-mail : c'est un compromis
 * assumé, le même que celui de tous les outils de planning de salon. Il est
 * temporaire, il ne donne accès qu'au carnet de rendez-vous de la personne, et
 * il doit être changé à la première connexion. Aucune donnée de paiement ni de
 * compte Deal&Co n'est joignable avec lui.
 */
export function memberAccessEmail({
  displayName,
  proName,
  loginId,
  password,
  loginUrl,
}: {
  /** Prénom du membre, tel que le salon l'affiche. */
  displayName: string;
  /** Nom de l'établissement qui remet l'accès. */
  proName: string;
  loginId: string;
  /** Mot de passe temporaire, à changer à la première connexion. */
  password: string;
  loginUrl: string;
}): string {
  return baseEmail({
    title: `Votre accès au planning — ${proName}`,
    heading: "Votre planning en ligne",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${displayName}</strong>,</p>
      <p style="margin:0 0 16px;">
        <strong style="color:#1a1b25;">${proName}</strong> vous a ouvert un accès à votre planning
        sur Deal&amp;Co. Vous y retrouvez vos rendez-vous à venir, avec le nom et le téléphone de
        chaque client.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="background:#f7f9fb;border-radius:14px;margin:0 0 20px;">
        <tr><td style="padding:18px 20px;font-size:15px;color:#464652;line-height:1.8;">
          Identifiant : <strong style="color:#1a1b25;font-family:monospace;">${loginId}</strong><br/>
          Mot de passe : <strong style="color:#1a1b25;font-family:monospace;">${password}</strong>
        </td></tr>
      </table>
      <p style="margin:0 0 16px;">
        Ce mot de passe est temporaire : il vous sera demandé d'en choisir un autre dès votre
        première connexion. Ne le transmettez à personne.
      </p>
    `,
    ctaLabel: "Ouvrir mon planning",
    ctaUrl: loginUrl,
    postCta:
      "Cet accès ne concerne que votre planning de travail. Il n'ouvre ni la fiche de " +
      "l'établissement, ni ses réglages, ni de compte Deal&Co personnel.",
  });
}

import { baseEmail } from "./base";

/**
 * Suppression définitive d'un compte banni.
 *
 * Envoyé une seule fois, au moment de la destruction, et jamais après : passé
 * cet instant l'adresse n'est plus conservée en clair nulle part. C'est donc
 * la dernière communication possible avec cette personne, et elle doit tenir
 * seule — d'où le rappel de la date du bannissement, du motif, et du caractère
 * irréversible de la mesure.
 *
 * Le message ne détaille pas les mécanismes de détection : dire ce qui est
 * conservé pour empêcher la réinscription reviendrait à expliquer comment le
 * contourner.
 */
export function accountDeletedEmail({
  name,
  bannedAt,
  deletedAt,
  reason,
}: {
  name: string;
  /** Date du bannissement, déjà formatée (JJ/MM/AAAA). */
  bannedAt: string;
  /** Date de la suppression, déjà formatée (JJ/MM/AAAA). */
  deletedAt: string;
  reason?: string | null;
}): string {
  const reasonBlock = reason
    ? `<div style="background:#fff5f5;border-left:3px solid #e11d48;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 16px;text-align:left;">
         <p style="font-size:13px;color:#9f1239;font-weight:700;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.5px;">Motif du bannissement</p>
         <p style="font-size:14px;color:#424751;line-height:1.7;margin:0;">${reason}</p>
       </div>`
    : "";

  return baseEmail({
    title: "Votre compte Deal&Co a été supprimé définitivement",
    heading: "Votre compte a été supprimé définitivement",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
      <p style="margin:0 0 16px;">Votre compte Deal&amp;Co a été <strong style="color:#1a1b25;">banni le ${bannedAt}</strong> à la suite d'une décision de modération.</p>
      ${reasonBlock}
      <p style="margin:0 0 16px;">Ce compte a été <strong style="color:#1a1b25;">définitivement supprimé le ${deletedAt}</strong>. Ont été effacés : votre profil, vos annonces, vos photos et vos fichiers, ainsi que les données associées dont la conservation n'est pas requise.</p>
      <div style="background:#fff5f5;border-left:3px solid #e11d48;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 16px;text-align:left;">
        <p style="font-size:14px;color:#424751;line-height:1.7;margin:0;"><strong style="color:#9f1239;">Cette suppression est irréversible.</strong> Les données effacées ne peuvent pas être restaurées, y compris à votre demande.</p>
      </div>
      <p style="margin:0 0 16px;">La création d'un nouveau compte avec cette adresse email n'est plus possible. Toute tentative de contourner cette mesure en ouvrant un autre compte constitue une violation de nos conditions d'utilisation.</p>
      <p style="margin:0;">Si vous estimez que cette décision repose sur une erreur, vous pouvez répondre à cet email en indiquant les éléments qui le justifient.</p>
    `,
    ctaLabel: "Consulter les conditions d'utilisation",
    ctaUrl: `${process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr"}/cgu`,
    postCta:
      "Cet email est envoyé une seule fois, au moment de la suppression. Votre adresse n'est plus conservée par Deal&Co.",
  });
}

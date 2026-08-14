import { baseEmail } from "./base";
import { escapeHtml } from "./escape";

/**
 * Remise des accès à l'espace annonceur.
 *
 * Le mot de passe transite en clair : c'est un compromis assumé, identique à
 * celui des accès d'équipe. Il est temporaire, il doit être changé à la
 * première connexion, et il n'ouvre qu'un espace publicitaire — ni compte
 * Deal&Co, ni moyen de paiement enregistré.
 *
 * L'e-mail dit trois choses, dans cet ordre : ce qu'on lui ouvre, avec quoi il
 * entre, ce qu'il devra faire en entrant. Rien d'autre.
 */
export function advertiserAccessEmail({
  firstName,
  loginId,
  password,
  loginUrl,
}: {
  firstName: string;
  loginId: string;
  /** Mot de passe temporaire, affiché une seule fois. */
  password: string;
  loginUrl: string;
}): string {
  return baseEmail({
    title: "Votre espace annonceur Deal&Co est disponible",
    heading: "Votre espace annonceur est ouvert",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${escapeHtml(firstName)}</strong>,</p>
      <p style="margin:0 0 16px;">
        Votre espace annonceur Deal&amp;Co est prêt. Vous y créez vos campagnes, choisissez où
        elles apparaissent, fixez votre budget et suivez vos résultats.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="background:#f7f9fb;border-radius:14px;margin:0 0 20px;">
        <tr><td style="padding:18px 20px;font-size:15px;color:#464652;line-height:1.8;">
          <strong style="display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#777683;margin-bottom:8px;">
            Vos accès
          </strong>
          Identifiant : <strong style="color:#1a1b25;font-family:monospace;">${escapeHtml(loginId)}</strong><br/>
          Mot de passe : <strong style="color:#1a1b25;font-family:monospace;">${escapeHtml(password)}</strong>
        </td></tr>
      </table>
      <p style="margin:0 0 16px;">
        Ce mot de passe est temporaire : il vous sera demandé d'en choisir un autre dès votre
        première connexion. Ne le transmettez à personne.
      </p>
    `,
    ctaLabel: "Ouvrir mon espace annonceur",
    ctaUrl: loginUrl,
    postCta:
      "Une question sur vos campagnes ou votre budget ? Répondez simplement à cet e-mail, " +
      "l'équipe Deal&Co vous répond.",
  });
}

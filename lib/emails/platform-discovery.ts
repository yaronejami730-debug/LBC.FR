import { baseEmail } from "./base";

export function platformDiscoveryEmail({
  recipientEmail,
}: {
  recipientEmail: string;
}): string {
  const baseUrl = "https://www.dealandcompany.fr";

  return baseEmail({
    title: "Découvrez Deal & Co — La marketplace locale",
    heading: "Bienvenue sur Deal\u00a0& Co\u00a0!",
    body: `
      <p style="margin:0 0 16px;">Bonjour,</p>
      <p style="margin:0 0 16px;">
        Nous souhaitons vous faire découvrir <strong style="color:#1a1b25;">Deal&nbsp;&amp;&nbsp;Co</strong>,
        la marketplace locale pour acheter, vendre et échanger près de chez vous.
      </p>

      <!-- Bloc features -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr>
          <td style="padding:0 0 12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
              style="background:#f7f9fb;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#2f6fb8;text-transform:uppercase;letter-spacing:0.1em;">
                    Achetez &amp; vendez localement
                  </p>
                  <p style="margin:0;font-size:14px;color:#424751;line-height:1.6;">
                    Trouvez des annonces près de chez vous — immobilier, véhicules, électronique, emploi et bien plus encore.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 12px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
              style="background:#f7f9fb;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#2f6fb8;text-transform:uppercase;letter-spacing:0.1em;">
                    Simple et rapide
                  </p>
                  <p style="margin:0;font-size:14px;color:#424751;line-height:1.6;">
                    Publiez votre première annonce en moins de 2 minutes. Ajoutez des photos, un prix, et c'est en ligne.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
              style="background:#f7f9fb;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#2f6fb8;text-transform:uppercase;letter-spacing:0.1em;">
                    Une communauté de confiance
                  </p>
                  <p style="margin:0;font-size:14px;color:#424751;line-height:1.6;">
                    Vendeurs vérifiés, messagerie intégrée et profils détaillés pour des échanges en toute sécurité.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 8px;font-size:14px;color:#424751;line-height:1.75;">
        Créez votre compte gratuitement et commencez dès aujourd'hui.
      </p>
    `,
    ctaLabel: "Découvrir la plateforme",
    ctaUrl: baseUrl,
    postCta:
      "Vous recevez cet email car notre équipe a pensé que la plateforme pourrait vous intéresser. Vous pouvez ignorer ce message si ce n'est pas le cas.",
  });
}

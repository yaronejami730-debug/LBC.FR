/**
 * Email de démarchage B2C — particuliers, pour les inciter à publier leurs
 * annonces sur Deal & Co (recrutement de vendeurs).
 *
 * Pas de prénom : les prospects ne sont pas inscrits → « Bonjour, » simple.
 */
import { baseEmail } from "./base";

export function particulierPitchEmail({
  baseUrl,
}: {
  baseUrl: string;
}): { subject: string; html: string } {
  const subject = "Vos objets oubliés valent de l'argent 💶";

  const body = `
    <p>Bonjour,</p>
    <p>Le vélo au garage. Le vieux téléphone dans un tiroir. Les meubles qui prennent la poussière.</p>
    <p><strong>Tout ça, c'est de l'argent qui dort.</strong> Et le revendre n'a jamais été aussi simple.</p>
    <p>Avec <strong>Deal &amp; Co</strong>, la marketplace locale&nbsp;:</p>
    <p>
      ⚡ <strong>Annonce en ligne en 2 minutes</strong> — une photo, un prix, c'est parti.<br/>
      💸 <strong>100&nbsp;% gratuit</strong> — vous gardez chaque euro de vos ventes, aucune commission.<br/>
      📍 <strong>Des acheteurs près de chez vous</strong> — remise en main propre, zéro frais de livraison.<br/>
      🛡️ <strong>En toute sécurité</strong> — profils vérifiés et messagerie intégrée.
    </p>
    <p>Votre première annonce vous attend. <strong>Combien allez-vous récupérer&nbsp;?</strong></p>
  `;

  return {
    subject,
    html: baseEmail({
      title: subject,
      heading: "Transformez ce que vous n'utilisez plus en argent.",
      body,
      ctaLabel: "Publier une annonce gratuite",
      ctaUrl: `${baseUrl}/post`,
      postCta: "Vous ne souhaitez plus recevoir ces emails ? Répondez « STOP ».",
    }),
  };
}

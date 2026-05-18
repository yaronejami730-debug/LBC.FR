/**
 * Email de démarchage B2B — agences immobilières, concessionnaires, pros.
 * Argument : distribution gratuite et automatique de leurs annonces.
 *
 * Prospection B2B (LCEN) : autorisée vers une adresse professionnelle si le
 * message concerne l'activité du destinataire. Opt-out inclus.
 */
import { baseEmail } from "./base";

export function agencyPitchEmail({
  agencyName,
  baseUrl,
}: {
  agencyName?: string;
  baseUrl: string;
}): { subject: string; html: string } {
  const name = agencyName?.trim();
  const subject = name
    ? `${name}, vos biens méritent plus d'acheteurs 🏡`
    : "Vos biens méritent plus d'acheteurs 🏡";

  const greeting = name ? `Bonjour ${name},` : "Bonjour,";

  const body = `
    <p>${greeting}</p>
    <p>Et si vos annonces touchaient une <strong>nouvelle audience d'acheteurs</strong> — sans rien changer à votre quotidien, et sans payer un centime&nbsp;?</p>
    <p>C'est exactement ce que fait <strong>Deal &amp; Co</strong>, la marketplace locale en pleine croissance&nbsp;:</p>
    <p>
      🔁 <strong>Synchronisation automatique</strong> — on importe vos annonces depuis votre site. Vous ne faites rien.<br/>
      💸 <strong>Gratuit à vie</strong> — aucun abonnement, aucune commission. Jamais.<br/>
      📍 <strong>Audience locale qualifiée</strong> — des acheteurs qui cherchent juste à côté de chez vous.<br/>
      🤝 <strong>Vos leads restent à vous</strong> — les contacts vous reviennent directement.
    </p>
    <p>Pendant que vos confrères <strong>paient cher</strong> leur visibilité, vous l'obtenez gratuitement. Il suffit de créer votre compte professionnel — on s'occupe du reste.</p>
  `;

  return {
    subject,
    html: baseEmail({
      title: subject,
      heading: "Plus d'acheteurs. Zéro euro.",
      body,
      ctaLabel: "Créer mon compte professionnel",
      ctaUrl: `${baseUrl}/register`,
      postCta:
        "Vous recevez cet email à titre professionnel. Pour ne plus être contacté, répondez « STOP ».",
    }),
  };
}

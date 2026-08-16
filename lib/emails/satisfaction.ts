/**
 * Email de demande d'avis.
 *
 * Court, et écrit comme on écrirait à quelqu'un. Pas de bandeau, pas de
 * promotion, pas de compte à rebours : rien qui ressemble à une campagne. Le
 * destinataire doit avoir l'impression qu'on lui demande son avis, pas qu'un
 * automate a atteint un seuil.
 *
 * Les quatre visages ne sont pas décoratifs : chacun est un lien qui pré-remplit
 * la note et ouvre le formulaire. Un clic suffit à répondre à la question
 * essentielle ; le reste du questionnaire est facultatif. Demander cinq
 * réponses avant la première ferait fermer l'onglet.
 */

import { baseEmail } from "./base";
import { escapeHtml } from "./escape";

export type SatisfactionEmailInput = {
  firstName: string | null;
  /** URL signée du questionnaire. */
  url: string;
  /** Renseigné quand la sollicitation suit une série de publications. */
  listingCount?: number | null;
};

const FACES: { rating: number; emoji: string; label: string }[] = [
  { rating: 5, emoji: "😀", label: "Très satisfait" },
  { rating: 4, emoji: "🙂", label: "Satisfait" },
  { rating: 3, emoji: "😐", label: "Moyen" },
  { rating: 2, emoji: "🙁", label: "Insatisfait" },
];

export function satisfactionEmail({
  firstName,
  url,
  listingCount,
}: SatisfactionEmailInput): string {
  const greeting = firstName ? `Bonjour ${escapeHtml(firstName)},` : "Bonjour,";

  // Nommer ce que la personne vient de faire vaut mieux qu'une formule creuse :
  // « vous utilisez Deal&Co depuis quelque temps » pourrait s'adresser à
  // n'importe qui, et se lit comme tel.
  const opening =
    listingCount && listingCount >= 2
      ? `Vous avez publié ${listingCount} annonces ces derniers jours sur Deal&nbsp;&amp;&nbsp;Co.`
      : "Vous utilisez Deal&nbsp;&amp;&nbsp;Co depuis quelque temps.";

  const faces = FACES.map(
    (f) => `
        <td align="center" style="padding:0 6px;">
          <a href="${url}&amp;r=${f.rating}" style="text-decoration:none;display:block;">
            <span style="font-size:30px;line-height:1;display:block;">${f.emoji}</span>
            <span style="font-size:11px;color:#727782;display:block;margin-top:6px;">${f.label}</span>
          </a>
        </td>`,
  ).join("");

  return baseEmail({
    title: "Votre avis nous intéresse — Deal & Co",
    heading: "Votre avis nous intéresse",
    body: `
      <p style="margin:0 0 14px;">${greeting}</p>
      <p style="margin:0 0 20px;">${opening} Nous aimerions savoir ce que vous en pensez —
      c'est ce qui nous dit quoi améliorer.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
        <tr>${faces}</tr>
      </table>
      <p style="margin:0;font-size:13px;color:#777683;">Une question, deux minutes si le cœur
      vous en dit. Vos réponses ne sont utilisées que pour améliorer le site.</p>
    `,
    ctaLabel: "Donner mon avis",
    ctaUrl: url,
    postCta: "Merci pour votre aide.",
  });
}

/** Objet : une question, pas une injonction. */
export function satisfactionSubject(): string {
  return "Votre avis sur Deal & Co ?";
}

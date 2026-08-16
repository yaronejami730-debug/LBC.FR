/**
 * Relances d'un formulaire de dépôt abandonné.
 *
 * Deux messages, deux intentions distinctes :
 *  1. `draftSavedEmail` — rassurer. Le vendeur a fermé l'onglet en croyant
 *     avoir tout perdu ; on lui apprend que sa saisie est conservée.
 *  2. `draftReminderEmail` — rappeler, une seule fois. On y annonce la date
 *     de suppression : un rappel qui ne dit pas ce qui va se passer ensuite
 *     n'est qu'une relance de plus.
 *
 * Au-delà de ces deux messages, plus rien n'est envoyé pour ce brouillon.
 */

import { baseEmail } from "./base";
import { escapeHtml } from "./escape";

/** Résumé de ce que le vendeur avait déjà saisi, quand on le connaît. */
function recapBlock({ title, category }: { title: string | null; category: string | null }): string {
  const rows = [
    title ? ["Annonce", title] : null,
    category ? ["Catégorie", category] : null,
  ].filter(Boolean) as [string, string][];

  if (rows.length === 0) return "";

  const cells = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:4px 0;color:#5a5b6e;font-size:14px;">${escapeHtml(label)}</td>
          <td style="padding:4px 0;color:#1a1b25;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:0 0 20px;border:1px solid #e6e7ee;border-radius:12px;padding:14px 16px;">
      ${cells}
    </table>`;
}

/**
 * Première relance — envoyée environ 1 h 30 après le dernier geste sur le
 * formulaire, une fois seulement.
 */
export function draftSavedEmail({
  name,
  title,
  category,
  ctaUrl,
  keepDays,
}: {
  name: string;
  title: string | null;
  category: string | null;
  ctaUrl: string;
  keepDays: number;
}): string {
  return baseEmail({
    title: "Votre annonce est enregistrée en brouillon — Deal & Co",
    heading: "Votre annonce est en brouillon",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${escapeHtml(name)}</strong>,</p>
      <p style="margin:0 0 16px;">Vous étiez en bonne voie pour publier, mais le formulaire n'a pas été terminé. Nous avons enregistré votre saisie dans vos brouillons : rien n'est perdu.</p>
      ${recapBlock({ title, category })}
      <p style="margin:0 0 16px;">Reprenez où vous en étiez — tout est déjà pré-rempli, il ne reste que les champs manquants.</p>
      <p style="margin:0;color:#5a5b6e;font-size:14px;">Les brouillons sont conservés ${keepDays} jours, puis supprimés automatiquement.</p>
    `,
    ctaLabel: "Reprendre mon annonce",
    ctaUrl,
  });
}

/**
 * Seconde et dernière relance — environ 4 h après la première, si le
 * brouillon n'a toujours pas bougé.
 */
export function draftReminderEmail({
  name,
  title,
  category,
  ctaUrl,
  deleteOn,
}: {
  name: string;
  title: string | null;
  category: string | null;
  ctaUrl: string;
  /** Date de suppression automatique, déjà formatée en français. */
  deleteOn: string;
}): string {
  return baseEmail({
    title: "Votre annonce est toujours en brouillon — Deal & Co",
    heading: "Votre annonce attend toujours",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${escapeHtml(name)}</strong>,</p>
      <p style="margin:0 0 16px;">Votre annonce est toujours en brouillon, elle n'est donc visible par personne.</p>
      ${recapBlock({ title, category })}
      <p style="margin:0 0 16px;">Si vous avez rencontré un problème pendant la publication, répondez à cet email : nous regarderons.</p>
      <p style="margin:0;color:#5a5b6e;font-size:14px;">Sans reprise de votre part, ce brouillon sera supprimé automatiquement le ${escapeHtml(deleteOn)}. C'est notre dernier rappel pour cette annonce.</p>
    `,
    ctaLabel: "Terminer mon annonce",
    ctaUrl,
  });
}

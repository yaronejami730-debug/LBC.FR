import { baseEmail } from "./base";
import { ATTRIBUTION_SOURCES } from "@/lib/attribution";

/**
 * « Comment nous avez-vous connus ? » — une question, six boutons.
 *
 * ── Ce qui a guidé la rédaction ───────────────────────────────────────────
 *
 * Un sondage envoyé à des gens qui n'ont rien demandé se juge à une chose :
 * est-ce qu'il leur prend moins de temps qu'il n'en fait perdre. D'où une seule
 * question, la réponse en un geste, et la raison de la demande dite franchement
 * — nos statistiques ne voient que le dernier clic, jamais ce qui a fait venir
 * la première fois.
 *
 * Aucune contrepartie promise : un bon d'achat contre une réponse achète des
 * réponses au hasard, pas la vérité.
 *
 * Les boutons mènent à la page de réponse avec le choix pré-coché ; c'est là
 * qu'un geste l'enregistre. Le détour évite que les antivirus de messagerie,
 * qui ouvrent tous les liens d'un message, répondent à la place des gens.
 */
export function attributionSurveyEmail({
  name,
  surveyUrl,
}: {
  name: string;
  /** Page de réponse, jeton compris. La source est ajoutée par bouton. */
  surveyUrl: string;
}): string {
  const buttons = ATTRIBUTION_SOURCES.map(
    (s) => `
      <a href="${surveyUrl}&s=${s.key}"
         style="display:block;margin:0 0 10px;padding:14px 18px;border:1px solid #e6e8eb;border-radius:12px;
                color:#191c1e;text-decoration:none;font-size:15px;font-weight:600;background:#ffffff;">
        ${s.label}
      </a>`,
  ).join("");

  return baseEmail({
    title: "Comment nous avez-vous connus ? — Deal & Co",
    heading: "Une question, une seule",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
      <p style="margin:0 0 16px;">Nous cherchons à savoir <strong style="color:#1a1b25;">comment vous avez découvert Deal&nbsp;&amp;&nbsp;Co</strong>. Nos statistiques ne voient que le dernier clic : si vous nous avez découverts dans une vidéo puis retrouvés par une recherche, la vidéo n'apparaît nulle part.</p>
      <p style="margin:0 0 20px;">Un clic sur la bonne réponse suffit :</p>
      ${buttons}
    `,
    ctaLabel: "Répondre",
    ctaUrl: surveyUrl,
    postCta:
      "Une seule réponse, aucune inscription : le lien vous reconnaît. Nous ne vous solliciterons pas une deuxième fois pour cette question.",
  });
}

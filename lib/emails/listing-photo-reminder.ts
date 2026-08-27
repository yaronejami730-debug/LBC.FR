import { baseEmail } from "./base";
import { escapeHtml } from "./escape";

const BASE = "https://www.dealandcompany.fr";

/** Ce qui manque à une annonce pour entrer dans l'index, en clair. */
export type MissingItem = { label: string; detail: string };

export type ReminderListing = {
  id: string;
  title: string;
  missing: MissingItem[];
};

/**
 * Rappel « votre annonce n'est pas visible sur Google », et ce qui l'en empêche.
 *
 * ── Un message par personne ──────────────────────────────────────────────
 *
 * La version précédente prenait une seule annonce. Cela convient tant que le
 * rappel part à la publication ; cela devient nuisible dès qu'on rattrape un
 * retard. Relevé du 27/08/2026 : 40 annonces sous les seuils pour 15 vendeurs,
 * dont un seul en porte vingt. Vingt courriels à la même personne dans la même
 * minute, c'est perdre le vendeur le plus actif du site.
 *
 * ── Tous les motifs, pas seulement les photos ────────────────────────────
 *
 * Le message annonçait « ajoutez des photos » quel que soit le problème réel.
 * Un vendeur à qui il manque quinze lignes de description ajoutait donc une
 * photo, ne voyait rien changer, et concluait que le conseil ne servait à
 * rien. Les motifs viennent maintenant du juge d'indexabilité
 * (`lib/seo/indexability.ts`) — le même qui décide du `noindex` — et chaque
 * annonce affiche exactement ce qui lui manque, chiffré.
 *
 * On ne liste que les motifs que le vendeur peut corriger. Une annonce écartée
 * parce qu'elle est importée d'un flux partenaire n'a rien à faire ici : lui
 * demander un geste impossible ne sert personne.
 */
export function listingPhotoReminderEmail({
  name,
  listings,
}: {
  name: string;
  listings: ReminderListing[];
}): string {
  const single = listings.length === 1;

  const rows = listings
    .map(
      (listing) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #eee;">
            <a href="${BASE}/annonce/${escapeHtml(listing.id)}/edit"
               style="color:#111;text-decoration:none;font-weight:600;">${escapeHtml(listing.title)}</a>
            <ul style="margin:6px 0 0;padding-left:18px;color:#666;font-size:13px;">
              ${listing.missing
                .map(
                  (m) =>
                    `<li><strong>${escapeHtml(m.label)}</strong> &mdash; ${escapeHtml(m.detail)}</li>`,
                )
                .join("")}
            </ul>
          </td>
        </tr>`,
    )
    .join("");

  return baseEmail({
    title: "Vos annonces ne sont pas visibles sur Google — Deal & Co",
    heading: single ? "Votre annonce n'apparaît pas sur Google" : "Vos annonces n'apparaissent pas sur Google",
    body: `
      <p>Bonjour ${escapeHtml(name)},</p>
      <p>${
        single
          ? "Votre annonce est bien en ligne sur Deal&amp;Co, mais elle n'est pas référencée dans les résultats de recherche Google."
          : `${listings.length} de vos annonces sont bien en ligne sur Deal&amp;Co, mais ne sont pas référencées dans les résultats de recherche Google.`
      }</p>
      <p>Il ne manque pas grand-chose. Voici précisément quoi :</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">${rows}</table>
      <p style="color:#666;font-size:13px;">Une fois complétée, l'annonce est proposée à Google automatiquement, sans démarche de votre part.</p>
    `,
    ctaLabel: single ? "Compléter mon annonce" : "Compléter mes annonces",
    // `/edit`, pas `/modifier` : la route s'appelle `app/annonce/[id]/edit`.
    // Le lien précédent tombait sur un 404 — on réclamait un geste sans donner
    // le moyen de l'accomplir.
    ctaUrl: single ? `${BASE}/annonce/${listings[0].id}/edit` : `${BASE}/mes-annonces`,
    postCta: "Vous pouvez ignorer ce message si vous avez déjà complété vos annonces.",
  });
}

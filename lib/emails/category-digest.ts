import { baseEmail } from "./base";

export type DigestListing = {
  title: string;
  price: number;
  location: string;
  url: string;
};

/**
 * Relance par centre d'intérêt : « X nouvelles annonces en Ameublement ».
 *
 * Un rappel générique ne fait rien ; un rappel qui nomme la catégorie suivie
 * et montre quatre annonces réelles se clique. D'où les vraies lignes plutôt
 * qu'un simple compteur.
 */
export function categoryDigestEmail({
  name,
  categoryLabel,
  count,
  listings,
  categoryUrl,
}: {
  name: string;
  categoryLabel: string;
  count: number;
  listings: DigestListing[];
  categoryUrl: string;
}): string {
  const rows = listings
    .map(
      (l) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #eceef0;">
          <a href="${l.url}" style="color:#191c1e;text-decoration:none;font-weight:600;">${l.title}</a>
          <div style="color:#777683;font-size:13px;margin-top:2px;">${l.location}</div>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #eceef0;text-align:right;white-space:nowrap;">
          <strong style="color:#2f6fb8;">${l.price.toLocaleString("fr-FR")} €</strong>
        </td>
      </tr>`,
    )
    .join("");

  return baseEmail({
    title: `${count} nouvelles annonces en ${categoryLabel} — Deal & Co`,
    heading: `${count} nouvelle${count > 1 ? "s" : ""} annonce${count > 1 ? "s" : ""} en ${categoryLabel}`,
    body: `
      <p style="margin:0 0 16px;">Bonjour ${name || ""},</p>
      <p style="margin:0 0 16px;">Depuis votre dernière visite, <strong>${count}</strong> annonce${count > 1 ? "s ont" : " a"} été publiée${count > 1 ? "s" : ""} dans la catégorie que vous suivez.</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 16px;">${rows}</table>
    `,
    ctaLabel: `Voir les annonces ${categoryLabel}`,
    ctaUrl: categoryUrl,
  });
}

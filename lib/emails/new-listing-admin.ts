import { baseEmail } from "./base";

export function newListingAdminEmail({
  sellerName,
  listingTitle,
  price,
  category,
  location,
  listingUrl,
  adminUrl,
}: {
  sellerName: string;
  listingTitle: string;
  price: number;
  category: string;
  location: string;
  listingUrl: string;
  adminUrl: string;
}): string {
  return baseEmail({
    title: "Nouvelle annonce publiée — Deal & Co",
    heading: "Nouvelle annonce publiée",
    body: `
      <p style="margin:0 0 16px;">Une nouvelle annonce vient d'être publiée automatiquement sur Deal&nbsp;&amp;&nbsp;Co.</p>
      <div style="background:#f5f2ff;border-left:3px solid #2f6fb8;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 16px;text-align:left;">
        <p style="font-size:14px;color:#1a1b25;font-weight:700;margin:0 0 6px;">${listingTitle}</p>
        <p style="font-size:13px;color:#424751;margin:0 0 4px;">Vendeur : <strong>${sellerName}</strong></p>
        <p style="font-size:13px;color:#424751;margin:0 0 4px;">Catégorie : ${category} · ${location}</p>
        <p style="font-size:13px;color:#2f6fb8;font-weight:700;margin:0;">${price.toLocaleString("fr-FR")} €</p>
      </div>
      <p style="margin:0;">Si cette annonce ne respecte pas les conditions d'utilisation, vous pouvez la retirer depuis le panneau d'administration.</p>
    `,
    ctaLabel: "Voir dans l'administration",
    ctaUrl: adminUrl,
  });
}

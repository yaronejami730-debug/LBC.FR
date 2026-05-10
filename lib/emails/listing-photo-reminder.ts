import { baseEmail } from "./base";

const BASE = "https://www.dealandcompany.fr";

export function listingPhotoReminderEmail({
  name,
  listingTitle,
  listingUrl,
}: {
  name: string;
  listingTitle: string;
  listingUrl: string;
}): string {
  return baseEmail({
    title: `Ajoutez des photos à votre annonce — Deal & Co`,
    heading: "Votre annonce est en ligne !",
    body: `
      <p>Bonjour ${name},</p>
      <p>Votre annonce <strong>&laquo;&nbsp;${listingTitle}&nbsp;&raquo;</strong> est publiée sur Deal&amp;Co.</p>
      <p>Les annonces <strong>avec au moins 3 photos</strong> reçoivent en moyenne <strong>5× plus de messages</strong> que celles sans photo. Ajoutez des photos maintenant pour maximiser vos chances de vendre rapidement.</p>
    `,
    ctaLabel: "Ajouter des photos",
    ctaUrl: `${BASE}/annonce/${listingUrl.split("/annonce/")[1] ?? ""}/modifier`,
    postCta: `Vous pouvez ignorer cet email si vous avez déjà ajouté des photos à votre annonce.`,
  });
}

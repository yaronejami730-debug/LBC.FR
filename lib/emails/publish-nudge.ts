import { baseEmail } from "./base";

export function publishNudgeEmail({
  name,
  message,
  category,
  ctaUrl,
}: {
  name: string;
  message: string;
  category: string | null;
  ctaUrl: string;
}): string {
  const catLine = category
    ? `<p style="margin:0 0 16px;color:#5a5b6e;">Catégorie : <strong style="color:#1a1b25;">${category}</strong></p>`
    : "";
  return baseEmail({
    title: "Votre annonce vous attend — Deal & Co",
    heading: message,
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
      ${catLine}
      <p style="margin:0 0 16px;">Quelques secondes suffisent pour finaliser : tout ce que vous avez déjà saisi est pré-rempli, il ne reste qu'à valider.</p>
      <p style="margin:0;color:#5a5b6e;font-size:14px;">Vous recevez cet email parce que vous avez commencé une annonce. Pour ne plus recevoir ces rappels, gérez vos préférences depuis votre compte.</p>
    `,
    ctaLabel: "Reprendre ma publication",
    ctaUrl,
  });
}

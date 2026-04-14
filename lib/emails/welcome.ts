import { baseEmail } from "./base";

export function welcomeEmail({ name }: { name: string }): string {
  return baseEmail({
    title: "Bienvenue sur Deal & Co",
    heading: "Bienvenue sur Deal&nbsp;&amp;&nbsp;Co",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${name}</strong>,</p>
      <p style="margin:0 0 16px;">Votre compte a bien été créé. Nous sommes ravis de vous accueillir sur
        <strong style="color:#1a1b25;">Deal&nbsp;&amp;&nbsp;Co</strong>, la marketplace de petites
        annonces gratuites entre particuliers en France.</p>
      <p style="margin:0;">Publiez vos annonces, contactez des vendeurs et trouvez de bonnes affaires
        près de chez vous — sans commission, sans intermédiaire.</p>
    `,
    ctaLabel: "Explorer les annonces",
    ctaUrl: "https://www.dealandcompany.fr",
    postCta:
      "Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet email. Votre adresse ne sera pas utilisée sans votre confirmation.",
  });
}

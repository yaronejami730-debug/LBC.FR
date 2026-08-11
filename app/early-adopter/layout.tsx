import { buildPageMetadata } from "@/lib/seo/metadata";

/**
 * Page d'acquisition publique — pas un tunnel privé.
 *
 * Elle est indexable : c'est une offre réelle, limitée et datée, que des
 * professionnels peuvent chercher. La page est un composant client, d'où ce
 * layout porteur de balises, sans logique ni rendu ajouté.
 */
export const metadata = buildPageMetadata({
  title: "Offre fondateurs — 50% de réduction sur vos publicités pendant 3 ans",
  description:
    "50 places pour les premiers professionnels de Deal&Co : moitié prix sur vos publicités pendant 3 ans. Pré-inscription gratuite et sans engagement.",
  path: "/early-adopter",
});

export default function EarlyAdopterLayout({ children }: { children: React.ReactNode }) {
  return children;
}

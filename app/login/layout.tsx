import { buildPrivateMetadata } from "@/lib/seo/metadata";

/**
 * La page est un composant client : elle ne peut pas exporter `metadata`.
 * Ce layout ne fait que porter les balises — aucune logique, aucun rendu
 * ajouté, donc aucun risque de régression sur le formulaire.
 */
export const metadata = buildPrivateMetadata(
  "Connexion",
  "Connectez-vous à votre compte Deal&Co.",
);

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import { buildPrivateMetadata } from "@/lib/seo/metadata";

export const metadata = buildPrivateMetadata(
  "Mot de passe oublié",
  "Recevez un lien de réinitialisation de votre mot de passe Deal&Co.",
);

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}

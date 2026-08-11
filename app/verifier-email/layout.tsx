import { buildPrivateMetadata } from "@/lib/seo/metadata";

export const metadata = buildPrivateMetadata(
  "Vérification de l'adresse e-mail",
  "Confirmez votre adresse e-mail pour activer votre compte Deal&Co.",
);

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return children;
}

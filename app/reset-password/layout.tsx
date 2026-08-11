import { buildPrivateMetadata } from "@/lib/seo/metadata";

export const metadata = buildPrivateMetadata(
  "Nouveau mot de passe",
  "Choisissez un nouveau mot de passe pour votre compte Deal&Co.",
);

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}

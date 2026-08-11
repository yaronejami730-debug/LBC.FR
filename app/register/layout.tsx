import { buildPrivateMetadata } from "@/lib/seo/metadata";

export const metadata = buildPrivateMetadata(
  "Créer un compte",
  "Créez votre compte Deal&Co pour publier des annonces et réserver chez des professionnels.",
);

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}

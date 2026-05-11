import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Modifier l'annonce — Deal&Co",
  robots: { index: false, follow: false },
};

export default function EditLayout({ children }: { children: React.ReactNode }) {
  return children;
}

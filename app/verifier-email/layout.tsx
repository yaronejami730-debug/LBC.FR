import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vérifier mon e-mail — Deal&Co",
  robots: { index: false, follow: false },
};

export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return children;
}

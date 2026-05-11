import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Republier l'annonce — Deal&Co",
  robots: { index: false, follow: false },
};

export default function RepublierLayout({ children }: { children: React.ReactNode }) {
  return children;
}

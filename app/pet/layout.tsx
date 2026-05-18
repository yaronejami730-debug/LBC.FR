import type { Metadata } from "next";
import PetNavbar from "@/components/pet/PetNavbar";
import PetFooter from "@/components/pet/PetFooter";

export const metadata: Metadata = {
  title: {
    default: "Deal&Co Pet — Pet-sitting, garde et services animaux",
    template: "%s | Deal&Co Pet",
  },
  description:
    "Trouvez un pet-sitter, un éleveur ou un toiletteur de confiance près de chez vous. Réservation et paiement sécurisés sur Deal&Co Pet.",
  alternates: {
    canonical: "https://pet.dealandcompany.fr",
  },
  openGraph: {
    title: "Deal&Co Pet — Mise en relation animaux",
    description: "Plateforme de mise en relation 100% animaux : pet-sitters, éleveurs, toiletteurs vérifiés.",
    url: "https://pet.dealandcompany.fr",
    siteName: "Deal&Co Pet",
    type: "website",
    locale: "fr_FR",
  },
};

export default function PetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <PetNavbar />
      <main className="pt-[80px] lg:pt-[128px]">{children}</main>
      <PetFooter />
    </div>
  );
}

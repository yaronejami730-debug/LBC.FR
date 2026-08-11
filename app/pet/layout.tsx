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
  // Pas de `alternates.canonical` ici.
  //
  // Un canonical posé sur un layout est hérité tel quel par toutes les pages
  // qui n'en déclarent pas : `/pet/comment-ca-marche` et `/pet/recherche`
  // annonçaient donc la racine `pet.dealandcompany.fr` comme leur URL
  // canonique. C'est l'ordre « n'indexe pas cette page, indexe l'accueil à la
  // place » — envoyé à chaque sous-page de la verticale. Chaque page pose
  // maintenant son propre canonical via `buildPageMetadata()`.
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

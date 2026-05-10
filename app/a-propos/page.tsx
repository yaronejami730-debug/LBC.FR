import Link from "next/link";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";

const BASE = "https://www.dealandcompany.fr";

export const metadata: Metadata = {
  title: "À propos de Deal&Co — Petites annonces gratuites entre particuliers",
  description:
    "Deal&Co est la plateforme française de petites annonces gratuites entre particuliers. Sans commission, sans algorithme de visibilité payant — achetez et vendez directement.",
  alternates: { canonical: `${BASE}/a-propos` },
  openGraph: {
    title: "À propos de Deal&Co",
    description: "La plateforme française de petites annonces gratuites sans commission.",
    url: `${BASE}/a-propos`,
    siteName: "Deal&Co",
    locale: "fr_FR",
    type: "website",
  },
};

const stats = [
  { label: "Annonces en ligne", value: "Gratuit" },
  { label: "Commission sur les ventes", value: "0 %" },
  { label: "Catégories", value: "14" },
  { label: "Contact vendeur", value: "Direct" },
];

const values = [
  {
    icon: "volunteer_activism",
    title: "Gratuit, vraiment",
    body: "Publication d'annonces gratuite, sans abonnement caché, sans commission sur les transactions. Vous gardez 100 % du prix de vente.",
  },
  {
    icon: "connect_without_contact",
    title: "Contact direct",
    body: "Pas d'intermédiaire entre acheteur et vendeur. La messagerie intégrée est chiffrée et sans publicité.",
  },
  {
    icon: "visibility",
    title: "Visibilité équitable",
    body: "Toutes les annonces sont traitées à égalité. Pas d'algorithme qui favorise les comptes payants. Les nouvelles annonces apparaissent en premier.",
  },
  {
    icon: "verified_user",
    title: "Modération active",
    body: "Chaque annonce est modérée avant publication pour garantir la qualité des offres et protéger les acheteurs.",
  },
];

export default function AProposPage() {
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Deal&Co",
    alternateName: ["Deal and Co", "Deal & Co", "dealandcompany"],
    url: BASE,
    logo: `${BASE}/logo.png`,
    description: "Plateforme française de petites annonces gratuites entre particuliers.",
    foundingDate: "2024",
    areaServed: { "@type": "Country", name: "France" },
    contactPoint: {
      "@type": "ContactPoint",
      email: "contact@dealandcompany.fr",
      contactType: "customer support",
      availableLanguage: "French",
    },
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen mb-24 md:mb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }} />
      <Navbar />

      <main className="pt-32 pb-16 px-6 max-w-4xl mx-auto">
        <nav aria-label="Fil d'Ariane" className="mb-8 text-sm text-outline flex items-center gap-2">
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <span className="text-on-surface font-semibold">À propos</span>
        </nav>

        {/* Hero */}
        <div className="mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-on-surface font-['Manrope'] mb-4">
            Une plateforme d&apos;annonces <span className="text-primary">sans compromis</span>
          </h1>
          <p className="text-xl text-on-surface-variant leading-relaxed max-w-2xl">
            Deal&amp;Co est né d&apos;un constat simple : les grandes plateformes de petites annonces sont devenues trop complexes, trop chères, et trop opaques pour les particuliers.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-surface-container p-5 text-center">
              <p className="text-2xl font-extrabold text-primary font-['Manrope']">{s.value}</p>
              <p className="text-sm text-outline mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Mission */}
        <section className="mb-16">
          <h2 className="text-2xl font-extrabold text-on-surface font-['Manrope'] mb-4">Notre mission</h2>
          <div className="space-y-4 text-on-surface-variant leading-relaxed">
            <p>
              Deal&amp;Co est une plateforme de petites annonces gratuites entre particuliers, basée en France. Notre objectif est de permettre à n&apos;importe qui de vendre ou d&apos;acheter un bien d&apos;occasion en quelques minutes, sans frais, sans commission, et sans intermédiaire superflu.
            </p>
            <p>
              Que vous vendiez un smartphone, une voiture, un canapé ou un appartement, vous méritez une plateforme qui travaille pour vous — pas pour ses propres revenus publicitaires. Deal&amp;Co est construite sur ce principe.
            </p>
            <p>
              Nous couvrons toute la France avec 14 catégories d&apos;annonces : immobilier, véhicules, mode, multimédia, maison, loisirs, animaux, services et bien plus. Chaque annonce est modérée avant publication pour garantir la fiabilité des offres.
            </p>
          </div>
        </section>

        {/* Values */}
        <section className="mb-16">
          <h2 className="text-2xl font-extrabold text-on-surface font-['Manrope'] mb-6">Nos engagements</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {values.map((v) => (
              <div key={v.title} className="bg-white rounded-2xl border border-surface-container p-6">
                <span className="material-symbols-outlined text-primary text-3xl mb-3 block" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {v.icon}
                </span>
                <h3 className="font-bold text-on-surface mb-2">{v.title}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-primary rounded-2xl p-8 text-white text-center">
          <h2 className="text-2xl font-extrabold font-['Manrope'] mb-2">Prêt à publier votre première annonce ?</h2>
          <p className="text-white/80 mb-6">Gratuit, en 2 minutes, sans inscription obligatoire pour consulter.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/post"
              className="inline-flex items-center justify-center gap-2 px-7 py-3 bg-white text-primary rounded-full font-bold shadow-lg active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-lg">add_circle</span>
              Publier une annonce
            </Link>
            <Link
              href="/search"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 border border-white/30 text-white rounded-full font-semibold hover:bg-white/15 transition-colors"
            >
              Parcourir les annonces
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
      <BottomNav />
    </div>
  );
}

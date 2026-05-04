import Link from "next/link";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";
import { getAllArticles } from "@/lib/blog";

const BASE = "https://www.dealandcompany.fr";

export const metadata: Metadata = {
  title: "Blog — Guides pratiques pour acheter et vendre entre particuliers",
  description:
    "Conseils, astuces et guides pratiques pour acheter et vendre en sécurité entre particuliers : véhicules, immobilier, électronique, mode et plus.",
  alternates: { canonical: `${BASE}/blog` },
  openGraph: {
    title: "Blog Deal&Co — Guides pratiques",
    description:
      "Conseils pour acheter et vendre en sécurité entre particuliers sur Deal&Co.",
    url: `${BASE}/blog`,
    siteName: "Deal&Co",
    type: "website",
    locale: "fr_FR",
  },
};

export default function BlogIndexPage() {
  const articles = getAllArticles();

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Articles Deal&Co",
    itemListElement: articles.map((a, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE}/blog/${a.slug}`,
      name: a.title,
    })),
  };

  return (
    <div className="bg-surface text-on-surface mb-24 md:mb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
      <Navbar />

      <main className="pt-32 pb-16 px-6 max-w-5xl mx-auto">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-outline flex items-center gap-2">
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <span className="text-on-surface font-semibold">Blog</span>
        </nav>

        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface">
            Guides pratiques pour acheter et vendre entre particuliers
          </h1>
          <p className="text-outline mt-3 leading-relaxed max-w-3xl">
            Conseils concrets pour estimer un prix juste, rédiger une annonce qui convertit,
            sécuriser un rendez-vous et finaliser une transaction sans mauvaise surprise.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/blog/${article.slug}`}
              className="group flex flex-col bg-white rounded-2xl border border-surface-container hover:shadow-md transition-all duration-200 p-6"
            >
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">
                {article.category}
              </span>
              <h2 className="text-xl font-bold text-on-surface group-hover:text-primary transition-colors leading-snug">
                {article.title}
              </h2>
              <p className="text-outline text-sm mt-3 leading-relaxed line-clamp-3">
                {article.description}
              </p>
              <div className="mt-4 flex items-center justify-between text-xs text-outline">
                <time dateTime={article.publishedAt}>
                  {new Date(article.publishedAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </time>
                <span className="font-semibold text-primary inline-flex items-center gap-1">
                  Lire l&apos;article
                  <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <SiteFooter />
      <BottomNav />
    </div>
  );
}

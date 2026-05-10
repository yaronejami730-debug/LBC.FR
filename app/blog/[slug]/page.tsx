import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import SiteFooter from "@/components/SiteFooter";
import { getAllArticles, getArticleBySlug, getRelatedArticles } from "@/lib/blog";
import { CATEGORIES } from "@/lib/categories";

const BASE = "https://www.dealandcompany.fr";

export function generateStaticParams() {
  return getAllArticles().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};

  const url = `${BASE}/blog/${article.slug}`;

  return {
    title: article.title,
    description: article.description,
    keywords: article.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: article.title,
      description: article.description,
      url,
      siteName: "Deal&Co",
      type: "article",
      locale: "fr_FR",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      images: [{ url: `${BASE}/blog/${article.slug}/opengraph-image`, width: 1200, height: 630, alt: article.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
      images: [`${BASE}/blog/${article.slug}/opengraph-image`],
    },
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const related = getRelatedArticles(slug, 3);
  const relatedCategory = article.relatedCategoryId
    ? CATEGORIES.find((c) => c.id === article.relatedCategoryId)
    : null;

  const url = `${BASE}/blog/${article.slug}`;

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: {
      "@type": "Organization",
      name: "Deal&Co",
      url: BASE,
      "@id": `${BASE}/#org`,
    },
    publisher: {
      "@type": "Organization",
      name: "Deal&Co",
      url: BASE,
      logo: { "@type": "ImageObject", url: `${BASE}/logo-dealco.png`, width: 500, height: 160 },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: { "@type": "ImageObject", url: `${url}/opengraph-image`, width: 1200, height: 630 },
    keywords: article.keywords.join(", "),
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", "h2", "article p:first-of-type"],
    },
    isPartOf: { "@type": "WebSite", "@id": `${BASE}/#website`, name: "Deal&Co" },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE}/blog` },
      { "@type": "ListItem", position: 3, name: article.title, item: url },
    ],
  };

  const faqLd =
    article.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: article.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  return (
    <div className="bg-surface text-on-surface mb-24 md:mb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}
      <Navbar />

      <main className="pt-32 pb-16 px-6 max-w-3xl mx-auto">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-outline flex items-center gap-2 flex-wrap">
          <Link href="/" className="hover:text-primary transition-colors">Accueil</Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-primary transition-colors">Blog</Link>
          <span>/</span>
          <span className="text-on-surface font-semibold line-clamp-1">{article.title}</span>
        </nav>

        <article>
          <header className="mb-8">
            <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
              {article.category}
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface leading-tight mt-2">
              {article.title}
            </h1>
            <div className="mt-4 text-sm text-outline flex items-center gap-3">
              <time dateTime={article.publishedAt}>
                Publié le{" "}
                {new Date(article.publishedAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </time>
              {article.updatedAt !== article.publishedAt && (
                <>
                  <span>·</span>
                  <time dateTime={article.updatedAt}>
                    Mis à jour le{" "}
                    {new Date(article.updatedAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>
                </>
              )}
            </div>
          </header>

          <p className="text-lg text-on-surface leading-relaxed mb-8">{article.intro}</p>

          {article.sections.map((section, i) => (
            <section key={i} className="mb-10">
              <h2 className="text-2xl font-bold tracking-tight text-on-surface mb-4">
                {section.h2}
              </h2>
              <div className="space-y-4">
                {section.paragraphs.map((p, j) => (
                  <p key={j} className="text-on-surface leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}

          {article.faq.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold tracking-tight text-on-surface mb-5">
                Questions fréquentes
              </h2>
              <div className="space-y-3">
                {article.faq.map((item, i) => (
                  <details
                    key={i}
                    className="bg-white rounded-xl border border-surface-container p-4 group"
                  >
                    <summary className="cursor-pointer font-semibold text-on-surface flex justify-between items-center list-none">
                      {item.q}
                      <span className="material-symbols-outlined text-outline group-open:rotate-180 transition-transform">
                        expand_more
                      </span>
                    </summary>
                    <p className="mt-3 text-on-surface-variant leading-relaxed">{item.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          <section className="mt-12 bg-gradient-to-br from-primary via-primary to-primary/85 rounded-2xl p-7 md:p-9 text-white">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-tight">
              {relatedCategory
                ? `Vendez ${relatedCategory.label.toLowerCase()} dès maintenant`
                : "Publiez votre annonce dès maintenant"}
            </h2>
            <p className="text-white/90 mt-2 leading-relaxed max-w-2xl">
              {relatedCategory
                ? `Mettez ces conseils en pratique : créez votre annonce ${relatedCategory.label.toLowerCase()} en 2 minutes, gratuitement et sans commission.`
                : "Créez votre annonce en 2 minutes, gratuitement et sans commission. Modération rapide, contact direct avec les acheteurs."}
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(
                  relatedCategory ? `/post?category=${relatedCategory.id}` : "/post",
                )}`}
                className="inline-flex items-center justify-center gap-2 px-7 py-3 bg-white text-primary rounded-full font-bold shadow-lg active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                Publier mon annonce gratuitement
              </Link>
              {relatedCategory && (
                <Link
                  href={`/annonces/${relatedCategory.id}`}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 border border-white/30 text-white rounded-full font-semibold hover:bg-white/15 transition-colors"
                >
                  Voir les annonces {relatedCategory.label}
                </Link>
              )}
            </div>
            <p className="mt-4 text-xs text-white/70">
              100% gratuit · Sans commission · Modération rapide
            </p>
          </section>
        </article>

        {related.length > 0 && (
          <section className="mt-12 border-t border-surface-container pt-10">
            <h2 className="text-xl font-bold text-on-surface mb-5">À lire aussi</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/blog/${r.slug}`}
                  className="group block bg-white rounded-xl border border-surface-container p-4 hover:shadow-md transition-all"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                    {r.category}
                  </span>
                  <h3 className="text-base font-bold text-on-surface mt-1 leading-snug group-hover:text-primary transition-colors line-clamp-3">
                    {r.title}
                  </h3>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
      <BottomNav />
    </div>
  );
}

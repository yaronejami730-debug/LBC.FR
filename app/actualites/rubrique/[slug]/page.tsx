/**
 * Une rubrique de Deal&Co Info — `/actualites/rubrique/societe`.
 *
 * La rubrique n'est pas devinée du texte : elle vient du flux d'où l'article
 * sort. C'est le média qui range ses propres articles, et il le fait mieux
 * qu'un classement reconstruit après coup.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import ArticleCard from "@/components/news/ArticleCard";
import { getNewsFeed } from "@/lib/news/articles";
import { newsMetadata, collectionJsonLd, breadcrumbJsonLd } from "@/lib/news/seo";
import { safeJsonLd } from "@/lib/json-ld";
import { byline, frDateTime, lede } from "@/lib/news/format";
import { INFO_SECTIONS, sectionLabel } from "@/lib/news/sources";

export const revalidate = 300;

export async function generateStaticParams() {
  return INFO_SECTIONS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // `auto` a sa propre une : il n'y a pas de rubrique auto dans Deal&Co Info.
  const label = INFO_SECTIONS.some((s) => s.slug === slug) ? sectionLabel(slug) : null;
  if (!label) return {};

  const articles = await getNewsFeed(null, 30, 0, slug);

  // Plus de seuil d'indexation. Il en existait un — six articles — et il
  // écartait des pages qui, dès le premier article, montrent un titre daté,
  // signé, une photo et une dizaine de lignes de texte. Une rubrique vide, elle,
  // ne demande pas l'index : elle n'existe pas, `notFound()` s'en charge.
  return newsMetadata({
    // Le gabarit de `app/layout.tsx` ajoute déjà « | Deal&Co » : le répéter ici
    // donnait « Sport — … | Deal&Co Info | Deal&Co » dans l'onglet et le SERP.
    title: `Actualité ${label.toLowerCase()} — Deal&Co Info`,
    description: `Toute l'actualité ${label.toLowerCase()} suivie par Deal&Co Info : ${articles.length} articles datés et signés, mis à jour tous les quarts d'heure à partir des flux de la presse.`,
    path: `/actualites/rubrique/${slug}`,
    image: articles[0]?.imageUrl,
    publishedAt: articles[0]?.publishedAt,
  });
}

export default async function SectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const label = INFO_SECTIONS.some((s) => s.slug === slug) ? sectionLabel(slug) : null;
  if (!label) notFound();

  const articles = await getNewsFeed(null, 30, 0, slug);
  // Rubrique vide : rien à montrer, la page n'a pas lieu d'être.
  if (articles.length === 0) notFound();

  const [lead, ...reste] = articles;

  const jsonLd = collectionJsonLd({
    name: `${label} — Deal&Co Info`,
    description: `L'actualité ${label.toLowerCase()} du jour, captée sur les flux de la presse.`,
    path: `/actualites/rubrique/${slug}`,
    articles,
  });

  const breadcrumb = breadcrumbJsonLd([
    { name: "Accueil", path: "" },
    { name: "Deal&Co Info", path: "/actualites" },
    { name: label, path: `/actualites/rubrique/${slug}` },
  ]);

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumb) }} />
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 pt-32 pb-16">
        <nav className="mb-4 text-xs text-outline">
          <Link href="/actualites" className="hover:text-primary">
            Deal&amp;Co Info
          </Link>
          <span className="mx-1.5">›</span>
          <span>{label}</span>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
            {label}
          </h1>
          <p className="mt-2 text-xs text-outline">
            {articles.length} article{articles.length > 1 ? "s" : ""} · dernier daté du{" "}
            <time dateTime={articles[0].publishedAt.toISOString()}>
              {frDateTime(articles[0].publishedAt)}
            </time>
          </p>
        </header>

        <nav aria-label="Rubriques" className="mb-8 flex flex-wrap gap-2 border-b border-surface-container pb-4">
          {INFO_SECTIONS.map((s) => (
            <Link
              key={s.slug}
              href={`/actualites/rubrique/${s.slug}`}
              aria-current={s.slug === slug ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                s.slug === slug
                  ? "bg-primary text-white"
                  : "bg-surface-container text-on-surface hover:bg-primary hover:text-white"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </nav>

        {/* L'ouverture de la rubrique : le plus récent, en grand, avec son
            texte long. Une rubrique qui commence par une grille de vignettes
            n'a pas de premier article — elle a trente articles égaux, et le
            lecteur ne sait pas par où entrer. */}
        <article className="mb-10 grid gap-6 border-b border-surface-container pb-10 md:grid-cols-[3fr_2fr]">
          <div>
            <Link href={`/actualites/${lead.slug}`} className="group block">
              {lead.imageUrl && (
                <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-surface-container">
                  <Image
                    src={lead.imageUrl}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 560px"
                    quality={75}
                    priority
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
              )}
            </Link>
          </div>
          <div>
            <Link href={`/actualites/${lead.slug}`} className="group block">
              <h2 className="text-2xl font-extrabold leading-tight tracking-tight text-on-surface group-hover:text-primary">
                {lead.title}
              </h2>
            </Link>
            <div className="mt-3 space-y-3 text-[15px] leading-[1.7] text-on-surface-variant">
              {lede(lead, 800).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-outline">
              {byline(lead.authorName, lead.publisher)} —{" "}
              <time dateTime={lead.publishedAt.toISOString()}>{frDateTime(lead.publishedAt)}</time>
            </p>
          </div>
        </article>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reste.map((a) => (
            <ArticleCard key={a.slug} article={a} />
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

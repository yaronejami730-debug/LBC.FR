/**
 * Une rubrique de Deal&Co Info — `/actualites/rubrique/societe`.
 *
 * La rubrique n'est pas devinée du texte : elle vient du flux d'où l'article
 * sort. C'est le média qui range ses propres articles, et il le fait mieux
 * qu'un classement reconstruit après coup.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import ArticleCard from "@/components/news/ArticleCard";
import { getNewsFeed } from "@/lib/news/articles";
import { frDateTime } from "@/lib/news/format";
import { INFO_SECTIONS, sectionLabel } from "@/lib/news/sources";

const BASE = "https://www.dealandcompany.fr";

export const revalidate = 900;

/** En dessous, la rubrique existe mais ne demande pas l'index. */
const MIN_TO_INDEX = 6;

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

  return {
    title: `${label} — Deal&Co Info`,
    description: `L'actualité ${label.toLowerCase()} suivie par Deal&Co Info, mise à jour chaque heure à partir des flux de la presse.`,
    alternates: { canonical: `${BASE}/actualites/rubrique/${slug}` },
    robots: articles.length >= MIN_TO_INDEX ? undefined : { index: false, follow: true },
  };
}

export default async function SectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const label = INFO_SECTIONS.some((s) => s.slug === slug) ? sectionLabel(slug) : null;
  if (!label) notFound();

  const articles = await getNewsFeed(null, 30, 0, slug);
  // Rubrique vide : rien à montrer, la page n'a pas lieu d'être.
  if (articles.length === 0) notFound();

  return (
    <div className="min-h-screen bg-surface text-on-surface">
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a, i) => (
            <ArticleCard key={a.slug} article={a} priority={i === 0} />
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

/**
 * Deal&Co Info — la une.
 *
 * ── Ce que cette page est ─────────────────────────────────────────────────
 *
 * Une revue de presse, tenue à jour tous les quarts d'heure à partir des flux
 * que les médias publient pour être repris. Chaque entrée porte sa signature,
 * sa date et son heure, et mène à une page qui cite l'article et renvoie à
 * l'original.
 *
 * Elle n'est pas que automobile, et c'est délibéré : Deal&Co vend aussi mode,
 * maison, multimédia, loisirs et animaux. Une revue de presse limitée aux
 * voitures serait plus étroite que le site qui la porte. L'automobile a sa
 * propre une, `/actualites/auto`.
 *
 * ── Pourquoi cette mise en page, et pas une grille ────────────────────────
 *
 * Une grille de cartes identiques traite un fait divers majeur et une brève de
 * la même façon : elle n'a pas de hiérarchie, donc elle n'informe pas — elle
 * range. Un journal, lui, dit ce qui compte par la place qu'il donne.
 *
 * D'où quatre dispositifs, chacun avec un rôle distinct :
 *
 *   · **l'ouverture** — un article, en grand, avec une dizaine de lignes de
 *     texte. C'est le jugement éditorial du jour, et il est assumé : c'est le
 *     plus récent des médias que nous suivons. Les deux lignes de chapô qui
 *     tenaient cette place auparavant ne racontaient rien : sous une photo en
 *     16/9 et un titre en corps 30, il fallait cliquer pour savoir de quoi il
 *     s'agissait, et la une ne remplissait pas son office ;
 *   · **le fil** — la colonne de droite, chronologique, à l'heure près. Elle
 *     répond à « qu'est-ce qui vient de tomber », ce que la hiérarchie ne dit
 *     pas ;
 *   · **les rubriques** — un article en vedette avec son texte long, ses
 *     voisins en liste. La liste tient quatre fois plus de titres qu'une carte
 *     pour la même hauteur, et c'est elle qui donne la sensation d'un site où
 *     il se passe des choses ;
 *   · **le fil complet** — en bas, tout ce que la page n'a pas encore montré.
 *     Une une qui s'arrête à quinze titres se termine ; une une qui en aligne
 *     cinquante se parcourt.
 *
 * ── Ce que la page affiche du travail des autres ──────────────────────────
 *
 * Jamais un article intégral. Ce qui est repris — titre, chapô, visuel,
 * signature, heure — est ce que reprend tout agrégateur, et le texte long est
 * une citation bornée à 45 % de l'article, 1 500 caractères au plus, attribuée
 * et suivie du renvoi vers l'original. Voir `lib/news/fulltext.ts`.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import ArticleCard from "@/components/news/ArticleCard";
import { getNewsFeed, coveredBrands, countArticles, type Article } from "@/lib/news/articles";
import { byline, frDateTime, frTime, frDate, lede } from "@/lib/news/format";
import { INFO_SECTIONS, INFO_SECTION_SLUGS } from "@/lib/news/sources";
import { newsMetadata, collectionJsonLd, breadcrumbJsonLd } from "@/lib/news/seo";
import { safeJsonLd } from "@/lib/json-ld";

/**
 * Cinq minutes.
 *
 * Le cron capte au quart d'heure ; il invalide lui-même le cache après chaque
 * passage (`revalidateTag("news")`). Cette valeur n'est donc qu'un filet : elle
 * borne le retard maximal si un passage échoue, sans faire travailler la base à
 * chaque visite.
 */
export const revalidate = 300;

export const metadata: Metadata = newsMetadata({
  title: "Deal&Co Info — toute l'actualité du jour",
  description:
    "L'actualité française mise à jour tous les quarts d'heure à partir des flux de la presse : société, économie, high-tech, sport et automobile. Chaque article est daté, signé et renvoie à sa source.",
  path: "/actualites",
});

/**
 * Une ligne du fil : titre, source, heure. Pas de visuel — c'est ce qui permet
 * d'en aligner quinze là où trois cartes tiendraient.
 */
function FilItem({ article, showDate = false }: { article: Article; showDate?: boolean }) {
  return (
    <li className="border-b border-surface-container py-2.5 last:border-b-0">
      <Link
        href={`/actualites/${article.slug}`}
        className="block text-sm font-semibold leading-snug text-on-surface hover:text-primary"
      >
        {article.title}
      </Link>
      <p className="mt-1 text-[11px] text-outline">
        <time dateTime={article.publishedAt.toISOString()}>
          {showDate ? frDateTime(article.publishedAt) : frTime(article.publishedAt)}
        </time>
        {" · "}
        {article.publisher}
      </p>
    </li>
  );
}

/**
 * Le texte long d'un article, en paragraphes.
 *
 * `lede` assemble le chapô du flux et le début de la citation du corps, sans
 * jamais répéter l'un dans l'autre. Ce qui en sort tient une dizaine de lignes
 * — de quoi comprendre l'article sans le lire, ce qu'une une doit permettre.
 */
function Lede({
  article,
  maxChars,
  className,
}: {
  article: Article;
  maxChars: number;
  className: string;
}) {
  const parts = lede(article, maxChars);
  if (parts.length === 0) return null;
  return (
    <div className={className}>
      {parts.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

export default async function ActualitesPage() {
  const [articles, brands, total, sections, auto] = await Promise.all([
    // Large : la page en montre une quarantaine, et le fil complet du bas vit
    // de ce que les blocs du haut n'ont pas pris.
    getNewsFeed(null, 60, 0, INFO_SECTION_SLUGS),
    coveredBrands(2),
    countArticles(null),
    // Une rubrique par flux d'origine : c'est le média qui range ses articles,
    // et il le fait mieux qu'un classement deviné après coup.
    Promise.all(
      INFO_SECTIONS.map(async (section) => ({
        ...section,
        articles: await getNewsFeed(null, 8, 0, section.slug),
      })),
    ),
    getNewsFeed(null, 4, 0, "auto"),
  ]);

  const [lead, ...suite] = articles;
  const secondaires = suite.slice(0, 4);
  // Le fil est chronologique et ne réserve rien : un titre déjà en ouverture y
  // reparaît, parce qu'un fil qui saute des dépêches n'est plus un fil.
  const fil = articles.slice(0, 18);

  // Ce qui est déjà passé sous les yeux du lecteur, pour ne pas le lui montrer
  // deux fois plus bas.
  const dejaVus = new Set<string>([lead?.slug, ...secondaires.map((a) => a.slug)].filter(Boolean) as string[]);

  const jsonLd = collectionJsonLd({
    name: "Deal&Co Info",
    description: "Revue de presse : l'actualité du jour, mise à jour tous les quarts d'heure.",
    path: "/actualites",
    articles: articles.slice(0, 30),
  });

  const breadcrumb = breadcrumbJsonLd([
    { name: "Accueil", path: "" },
    { name: "Deal&Co Info", path: "/actualites" },
  ]);

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumb) }} />
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 pt-32 pb-16">
        {/* ── Bandeau de titre ─────────────────────────────────────────── */}
        <header className="border-b-2 border-on-surface pb-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
              Deal&amp;Co Info
            </h1>
            {lead && (
              <p className="text-xs text-outline">
                {total} articles suivis · mis à jour{" "}
                <time dateTime={lead.publishedAt.toISOString()}>{frDateTime(lead.publishedAt)}</time>
              </p>
            )}
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-on-surface-variant">
            L&apos;actualité du jour, reprise des flux que la presse publie pour être
            reprise, et captée tous les quarts d&apos;heure. Chaque article porte sa
            signature, sa date et son heure, et renvoie à sa source. Pour
            l&apos;automobile, c&apos;est{" "}
            <Link href="/actualites/auto" className="font-semibold text-primary hover:underline">
              Deal&amp;Co Auto
            </Link>
            .
          </p>
        </header>

        {/* ── Rubriques ────────────────────────────────────────────────── */}
        <nav aria-label="Rubriques" className="mt-4 flex flex-wrap gap-2 border-b border-surface-container pb-4">
          {sections
            .filter((s) => s.articles.length > 0)
            .map((s) => (
              <Link
                key={s.slug}
                href={`/actualites/rubrique/${s.slug}`}
                className="rounded-full bg-surface-container px-4 py-2 text-xs font-bold uppercase tracking-wide text-on-surface transition-colors hover:bg-primary hover:text-white"
              >
                {s.label}
              </Link>
            ))}
          {/* L'auto sort de la grille : elle a sa propre une, avec ses cotes et
              ses annonces. Le lien reste, pour qui passe par ici. */}
          <Link
            href="/actualites/auto"
            className="rounded-full border border-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary transition-colors hover:bg-primary hover:text-white"
          >
            Deal&amp;Co Auto →
          </Link>
        </nav>

        {articles.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-surface-container bg-white p-6 text-sm text-on-surface-variant">
            La revue de presse est en cours de constitution. Revenez d&apos;ici peu.
          </p>
        ) : (
          <>
            {/* ── Ouverture + fil ────────────────────────────────────────── */}
            <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
              <div>
                {lead && (
                  <article>
                    <Link href={`/actualites/${lead.slug}`} className="group block">
                      {lead.imageUrl && (
                        <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-surface-container">
                          <Image
                            src={lead.imageUrl}
                            alt=""
                            fill
                            sizes="(max-width: 1024px) 100vw, 640px"
                            quality={75}
                            priority
                            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                        </div>
                      )}
                      <h2 className="mt-4 text-2xl font-extrabold leading-tight tracking-tight text-on-surface group-hover:text-primary md:text-[2rem]">
                        {lead.title}
                      </h2>
                    </Link>

                    {/* La dizaine de lignes qui manquait : le lecteur doit
                        pouvoir comprendre l'article sans quitter la une. */}
                    <Lede
                      article={lead}
                      maxChars={1100}
                      className="mt-4 space-y-3 text-[17px] leading-[1.75] text-on-surface-variant"
                    />

                    <p className="mt-4 text-xs text-outline">
                      {byline(lead.authorName, lead.publisher)} —{" "}
                      <time dateTime={lead.publishedAt.toISOString()}>
                        {frDate(lead.publishedAt)} à {frTime(lead.publishedAt)}
                      </time>
                      {" · "}
                      <Link href={`/actualites/${lead.slug}`} className="font-semibold text-primary hover:underline">
                        Lire la suite
                      </Link>
                    </p>
                  </article>
                )}

                {secondaires.length > 0 && (
                  <div className="mt-8 grid gap-4 sm:grid-cols-2">
                    {secondaires.map((a) => (
                      <ArticleCard key={a.slug} article={a} />
                    ))}
                  </div>
                )}
              </div>

              {/* Le fil : chronologique, à l'heure près. Il répond à « qu'est-ce
                  qui vient de tomber », ce que la hiérarchie ne dit pas. */}
              <aside className="lg:border-l lg:border-surface-container lg:pl-6">
                <h2 className="flex items-center gap-2 border-b-2 border-on-surface pb-2 text-sm font-extrabold uppercase tracking-wide text-on-surface">
                  <span className="inline-block h-2 w-2 rounded-full bg-primary" aria-hidden />
                  En continu
                </h2>
                <ul className="mt-2">
                  {fil.map((a) => (
                    <FilItem key={a.slug} article={a} />
                  ))}
                </ul>
                <Link
                  href="/actualites/feed.xml"
                  className="mt-3 inline-block text-xs font-semibold text-primary hover:underline"
                >
                  S&apos;abonner au flux ↗
                </Link>
              </aside>
            </div>

            {/* ── Une bande par rubrique ─────────────────────────────────── */}
            {sections.map((section) => {
              const items = section.articles.filter((a) => !dejaVus.has(a.slug));
              if (items.length === 0) return null;
              const [vedette, ...autres] = items;
              // La vedette et ses voisins sortent du fil complet du bas : la
              // page ne se répète pas d'un bloc à l'autre.
              for (const a of items) dejaVus.add(a.slug);
              return (
                <section key={section.slug} className="mt-12">
                  <div className="mb-4 flex items-baseline justify-between gap-4 border-b-2 border-on-surface pb-2">
                    <h2 className="text-xl font-extrabold tracking-tight text-on-surface">
                      {section.label}
                    </h2>
                    <Link
                      href={`/actualites/rubrique/${section.slug}`}
                      className="shrink-0 text-sm font-semibold text-primary hover:underline"
                    >
                      Tout voir →
                    </Link>
                  </div>

                  <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
                    <article>
                      <Link href={`/actualites/${vedette.slug}`} className="group block">
                        {vedette.imageUrl && (
                          <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-surface-container">
                            <Image
                              src={vedette.imageUrl}
                              alt=""
                              fill
                              sizes="(max-width: 768px) 100vw, 400px"
                              quality={70}
                              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            />
                          </div>
                        )}
                        <h3 className="mt-3 text-lg font-bold leading-snug text-on-surface group-hover:text-primary">
                          {vedette.title}
                        </h3>
                      </Link>
                      <Lede
                        article={vedette}
                        maxChars={700}
                        className="mt-2 space-y-2 text-sm leading-relaxed text-on-surface-variant"
                      />
                      <p className="mt-2 text-[11px] text-outline">
                        {byline(vedette.authorName, vedette.publisher)} —{" "}
                        <time dateTime={vedette.publishedAt.toISOString()}>
                          {frDateTime(vedette.publishedAt)}
                        </time>
                      </p>
                    </article>

                    {/* Les voisins en liste : quatre fois plus de titres qu'une
                        carte, à hauteur égale. */}
                    <ul>
                      {autres.map((a) => (
                        <FilItem key={a.slug} article={a} showDate />
                      ))}
                    </ul>
                  </div>
                </section>
              );
            })}

            {/* ── Passerelle vers l'auto ─────────────────────────────────── */}
            {auto.length > 0 && (
              <section className="mt-12 rounded-2xl border border-surface-container bg-white p-6">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-extrabold tracking-tight text-on-surface">
                      Deal&amp;Co Auto
                    </h2>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      L&apos;actualité automobile, avec la cote de chaque modèle et les
                      annonces d&apos;occasion entre particuliers.
                    </p>
                  </div>
                  <Link
                    href="/actualites/auto"
                    className="shrink-0 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/20 transition-transform active:scale-95"
                  >
                    Voir la une auto
                  </Link>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {auto.map((a) => (
                    <ArticleCard key={a.slug} article={a} />
                  ))}
                </div>
                {brands.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {brands.slice(0, 10).map((b) => (
                      <Link
                        key={b.brandSlug}
                        href={`/actualites/marque/${b.brandSlug}`}
                        className="rounded-full bg-surface-container px-3 py-1.5 text-xs font-semibold capitalize text-on-surface-variant transition-colors hover:text-primary"
                      >
                        {b.brandSlug.replace(/-/g, " ")}
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── Le fil complet ─────────────────────────────────────────
                Tout ce que les blocs du haut n'ont pas pris, du plus récent au
                plus ancien. Une une qui s'arrête à quinze titres se termine ;
                celle-ci se parcourt. */}
            {(() => {
              const reste = articles.filter((a) => !dejaVus.has(a.slug));
              if (reste.length === 0) return null;
              return (
                <section className="mt-12">
                  <h2 className="border-b-2 border-on-surface pb-2 text-xl font-extrabold tracking-tight text-on-surface">
                    Tout le fil
                  </h2>
                  <ul className="mt-2 grid gap-x-8 md:grid-cols-2">
                    {reste.map((a) => (
                      <FilItem key={a.slug} article={a} showDate />
                    ))}
                  </ul>
                </section>
              );
            })()}
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

import Link from "next/link";
import WaitlistForm from "./WaitlistForm";
import SearchInterestProof from "./SearchInterestProof";
import { getAllArticles } from "@/lib/blog";

type Props = {
  scope?: string;
  categoryId?: string;
  categoryLabel?: string;
  citySlug?: string;
  cityName?: string;
  subcategorySlug?: string;
  subcategoryLabel?: string;
};

export default async function EmptyStatePublishCTA({
  scope,
  categoryId,
  categoryLabel,
  citySlug,
  cityName,
  subcategorySlug,
  subcategoryLabel,
}: Props) {
  const segment = subcategoryLabel ?? categoryLabel ?? "";
  const localizedScope =
    scope ??
    (segment && cityName
      ? `${segment.toLowerCase()} à ${cityName}`
      : segment
        ? segment.toLowerCase()
        : "annonces");

  const headline = cityName
    ? `Soyez le premier à publier ${segment ? segment.toLowerCase() : "une annonce"} à ${cityName}`
    : `Soyez le premier à publier ${segment ? segment.toLowerCase() : "une annonce"}`;

  const subheadline = cityName
    ? `Aucune annonce ${localizedScope} pour le moment. Les acheteurs cherchent — votre annonce sera la première qu'ils verront.`
    : `Pas encore d'annonces dans cette section. Publiez la vôtre, elle apparaîtra immédiatement en tête de page.`;

  const postHref = `/login?callbackUrl=${encodeURIComponent(
    categoryId ? `/post?category=${categoryId}` : "/post",
  )}`;

  const relatedArticle = categoryId
    ? getAllArticles().find((a) => a.relatedCategoryId === categoryId)
    : undefined;

  return (
    <div className="col-span-full space-y-4">
      <SearchInterestProof
        cityName={cityName}
        categoryLabel={categoryLabel}
        subcategoryLabel={subcategoryLabel}
      />
      <div className="bg-gradient-to-br from-primary/8 via-white to-primary/5 rounded-3xl border border-primary/15 p-8 md:p-12 text-center">
        <div className="max-w-xl mx-auto">
          <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/15 mb-5">
            <span className="material-symbols-outlined text-3xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
              campaign
            </span>
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-on-surface leading-tight">
            {headline}
          </h2>
          <p className="text-on-surface-variant mt-3 leading-relaxed">{subheadline}</p>

          <div className="mt-6 grid grid-cols-3 gap-3 max-w-md mx-auto">
            <div className="bg-white rounded-xl border border-surface-container p-3">
              <span className="block text-xl">🆓</span>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-on-surface mt-1">
                100% gratuit
              </span>
            </div>
            <div className="bg-white rounded-xl border border-surface-container p-3">
              <span className="block text-xl">⚡</span>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-on-surface mt-1">
                2 minutes
              </span>
            </div>
            <div className="bg-white rounded-xl border border-surface-container p-3">
              <span className="block text-xl">📩</span>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-on-surface mt-1">
                Contact direct
              </span>
            </div>
          </div>

          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={postHref}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-primary text-white rounded-full font-bold shadow-lg shadow-primary/20 active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined text-lg">add_circle</span>
              Publier mon annonce gratuitement
            </Link>
            {categoryId && (
              <Link
                href={`/annonces/${categoryId}`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white border border-surface-container text-on-surface rounded-full font-semibold hover:bg-slate-50 transition-colors"
              >
                Voir toute la France
              </Link>
            )}
          </div>

          <p className="mt-5 text-xs text-outline">
            Sans frais, sans commission, sans engagement. Modération en quelques minutes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WaitlistForm
          citySlug={citySlug}
          cityName={cityName}
          categoryId={categoryId}
          categoryLabel={categoryLabel}
          subcategorySlug={subcategorySlug}
          subcategoryLabel={subcategoryLabel}
          source={cityName ? "empty-city-page" : "empty-category-page"}
        />
        {relatedArticle ? (
          <Link
            href={`/blog/${relatedArticle.slug}`}
            className="bg-white border border-surface-container rounded-2xl p-5 hover:shadow-md transition-all group flex flex-col justify-between"
          >
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Guide pratique</span>
              <p className="font-bold text-on-surface mt-1 leading-snug group-hover:text-primary transition-colors">
                {relatedArticle.title}
              </p>
              <p className="text-sm text-outline mt-2 line-clamp-2">{relatedArticle.description}</p>
            </div>
            <span className="text-primary text-sm font-semibold inline-flex items-center gap-1 mt-3">
              Lire l&apos;article
              <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </span>
          </Link>
        ) : (
          <Link
            href="/blog"
            className="bg-white border border-surface-container rounded-2xl p-5 hover:shadow-md transition-all group flex flex-col justify-between"
          >
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Blog</span>
              <p className="font-bold text-on-surface mt-1 leading-snug group-hover:text-primary transition-colors">
                Conseils pour bien acheter et vendre entre particuliers
              </p>
              <p className="text-sm text-outline mt-2">
                Estimer un prix, sécuriser une transaction, éviter les arnaques.
              </p>
            </div>
            <span className="text-primary text-sm font-semibold inline-flex items-center gap-1 mt-3">
              Voir tous les guides
              <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}

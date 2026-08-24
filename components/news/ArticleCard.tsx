/**
 * Carte d'article dans le fil.
 *
 * Photo, titre, signature, date **et heure** : les trois mentions obligatoires
 * voyagent avec la carte, pas seulement avec la page d'article. Quelqu'un qui
 * parcourt le fil doit voir d'un coup d'œil de qui vient l'article et de quand
 * il date — sans quoi une actualité d'hier et un essai de l'an dernier se
 * ressemblent.
 */

import Link from "next/link";
import Image from "next/image";
import type { Article } from "@/lib/news/articles";
import { byline, frDateTime } from "@/lib/news/format";

export default function ArticleCard({
  article,
  priority = false,
}: {
  article: Article;
  priority?: boolean;
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-surface-container bg-white transition-shadow hover:shadow-md">
      <Link href={`/actualites/${article.slug}`} className="relative block aspect-[16/9] overflow-hidden bg-surface-container">
        {article.imageUrl && (
          <Image
            src={article.imageUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            quality={70}
            priority={priority}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        {article.kind === "video" && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/75 px-2.5 py-1 text-[11px] font-semibold text-white">
            <span className="material-symbols-outlined text-sm leading-none">play_arrow</span>
            Vidéo
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-sm font-bold leading-snug text-on-surface">
          <Link href={`/actualites/${article.slug}`} className="hover:text-primary">
            {article.title}
          </Link>
        </h3>

        {article.summary && (
          <p className="line-clamp-2 text-xs leading-relaxed text-on-surface-variant">
            {article.summary}
          </p>
        )}

        <p className="mt-auto pt-1 text-[11px] text-outline">
          {byline(article.authorName, article.publisher)}
          {" — "}
          <time dateTime={article.publishedAt.toISOString()}>{frDateTime(article.publishedAt)}</time>
        </p>
      </div>
    </article>
  );
}

/**
 * Cycle de vie SEO d'une annonce : publication, modification, retrait.
 *
 * Un point d'entrée unique par événement, appelé depuis les routes API et les
 * actions d'administration. Avant, chaque appelant improvisait : l'un pingait
 * IndexNow, l'autre invalidait le cache, aucun ne tenait de trace, et personne
 * ne vérifiait si la page valait la peine d'être signalée. Résultat : des URL
 * en `noindex` étaient poussées à Bing à chaque publication.
 *
 * Ces fonctions ne lèvent jamais. Une annonce doit pouvoir être publiée même si
 * IndexNow répond mal ou si la base SEO est indisponible : le référencement est
 * un effet de bord de la publication, pas une condition.
 */

import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { listingSlug } from "@/lib/listing-slug";
import { pingIndexNow } from "@/lib/indexnow";
import { evaluateListing, priorityBand } from "@/lib/seo/indexability";
import { BASE } from "@/lib/seo/queue";

/** Colonnes nécessaires au verdict. Un `select` court, appelé sur le chemin chaud. */
const VERDICT_SELECT = {
  id: true,
  title: true,
  description: true,
  images: true,
  metadata: true,
  price: true,
  category: true,
  subcategory: true,
  location: true,
  condition: true,
  status: true,
  shadowBanned: true,
  deletedAt: true,
  qualityScore: true,
  reportCount: true,
  imageDupCount: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { isPro: true } },
} as const;

/**
 * Invalide l'instantané SEO.
 *
 * `revalidateTag` n'est utilisable que dans une action serveur ou un route
 * handler ; un appel depuis un script de maintenance lèverait. Faire échouer
 * une publication parce qu'un cache n'a pas pu être vidé serait absurde.
 */
function purgeSnapshot(): void {
  try {
    revalidateTag("listings");
  } catch (err) {
    console.warn("[SEO] invalidation de l'instantané ignorée :", err);
  }
}

/**
 * Annonce publiée ou remise en ligne.
 *
 * Enchaîne : verdict → écriture en file → invalidation du sitemap → signalement
 * IndexNow **si et seulement si** la page s'indexe.
 *
 * Cette dernière condition est le correctif principal. L'ancien code signalait
 * toute annonce approuvée, importées comprises : on demandait à Bing d'explorer
 * en priorité des pages que l'on marquait `noindex` dans le même souffle.
 */
export async function onListingPublished(listingId: string): Promise<void> {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: VERDICT_SELECT,
    });
    if (!listing) return;

    const verdict = evaluateListing({
      ...listing,
      metadata: listing.metadata ?? null,
      isPro: !!listing.user?.isPro,
    });

    const path = `/annonce/${listing.id}/${listingSlug(listing.title)}`;
    const url = `${BASE}${path}`;

    const shared = {
      path,
      type: "LISTING",
      entityId: listing.id,
      score: verdict.score,
      priorityBand: priorityBand(verdict.score, verdict.indexable),
      indexable: verdict.indexable,
      exclusionReasons: JSON.stringify(verdict.reasons),
      inSitemap: verdict.indexable,
      canonical: url,
      contentUpdatedAt: listing.updatedAt,
      status: verdict.indexable ? "ELIGIBLE" : "EXCLUDED",
    };

    await prisma.seoUrl.upsert({
      where: { url },
      create: { url, ...shared },
      update: shared,
    });

    purgeSnapshot();

    if (!verdict.indexable) {
      console.log(
        `[SEO] ${path} publiée mais hors index (score ${verdict.score}) — ` +
          `motifs : ${verdict.reasons.join(", ")}`,
      );
      return;
    }

    // Les pages de liste que cette annonce alimente changent aussi : les
    // signaler évite qu'un moteur revienne sur une catégorie périmée.
    const related = [url, BASE, `${BASE}/nouveautes`];
    await pingIndexNow(related);
    await prisma.seoUrl
      .update({ where: { url }, data: { status: "SUBMITTED", submittedAt: new Date() } })
      .catch(() => {});

    console.log(`[SEO] ${path} éligible (score ${verdict.score}) — signalée à IndexNow`);
  } catch (err) {
    console.error("[SEO] onListingPublished :", err);
  }
}

/**
 * Annonce modifiée.
 *
 * Même traitement que la publication — le verdict peut avoir changé dans les
 * deux sens : trois photos ajoutées la font entrer, une description raccourcie
 * la fait sortir. On ne crée jamais d'URL nouvelle : le slug dérive du titre,
 * et la route canonique redirige déjà l'ancienne forme vers la nouvelle.
 */
export async function onListingUpdated(listingId: string): Promise<void> {
  await onListingPublished(listingId);
}

/**
 * Annonce retirée, refusée ou supprimée.
 *
 * La ligne n'est pas détruite : savoir qu'une URL a existé, et qu'elle est
 * partie volontairement, a de la valeur le jour où Google la redemande. Elle
 * passe en GONE, sort du sitemap, et cesse d'être signalée.
 *
 * Aucun ping IndexNow au retrait : le protocole sert à annoncer un changement
 * de contenu, et la page répond désormais 404 aux visiteurs comme aux robots,
 * ce qui est le signal correct et suffisant.
 */
export async function onListingRemoved(listingId: string): Promise<void> {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true, title: true },
    });
    if (!listing) return;

    const path = `/annonce/${listing.id}/${listingSlug(listing.title)}`;

    await prisma.seoUrl.updateMany({
      where: { url: `${BASE}${path}` },
      data: { status: "GONE", indexable: false, inSitemap: false },
    });

    purgeSnapshot();
    console.log(`[SEO] ${path} retirée — sortie du sitemap`);
  } catch (err) {
    console.error("[SEO] onListingRemoved :", err);
  }
}

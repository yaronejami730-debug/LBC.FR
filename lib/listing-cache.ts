import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { listingUrl } from "@/lib/listing-slug";

/**
 * Purge du cache d'une fiche d'annonce — les deux adresses, pas une seule.
 *
 * ── Ce qui n'allait pas ───────────────────────────────────────────────────
 *
 * Huit endroits — modération, actions d'administration, centre de sécurité —
 * appelaient `revalidatePath(\`/annonce/\${id}\`)`. Or `/annonce/:id` ne rend
 * rien : elle lit le titre et redirige en 301 vers `/annonce/:id/:slug`. La
 * page réellement rendue, et donc réellement mise en cache, est la seconde.
 * Aucun de ces huit appels ne la purgeait.
 *
 * Le défaut est resté sans effet tant que la fiche appelait `auth()` : elle
 * était alors rendue à chaque requête, et un cache qu'on ne remplit pas n'a
 * pas besoin d'être vidé. Depuis qu'elle est cacheable, il devient visible —
 * une annonce refusée, masquée ou supprimée resterait affichée jusqu'à
 * l'expiration de la fenêtre de dix minutes. Sur une annonce retirée pour
 * fraude, dix minutes sont dix minutes de trop.
 *
 * ── Pourquoi une fonction plutôt qu'une seconde ligne à chaque appel ──────
 *
 * Parce que la seconde ligne a besoin du titre, que la plupart des appelants
 * n'ont pas sous la main — ils ne connaissent que l'identifiant. Recopier la
 * lecture huit fois garantissait qu'on en oublierait une, et c'est exactement
 * ce qui vient d'arriver avec la première.
 *
 * Passer `title` quand on l'a déjà évite la lecture. Sinon on la fait : une
 * requête sur une colonne, sur un chemin emprunté par une décision de
 * modération, pas par une page publique.
 */
export async function revalidateListing(id: string, title?: string | null) {
  // La route de redirection : sans effet visible, mais elle a son entrée de
  // cache et la laisser derrière fait diverger les deux.
  revalidatePath(`/annonce/${id}`);

  const resolved =
    title ??
    (await prisma.listing
      .findUnique({ where: { id }, select: { title: true } })
      .then((l) => l?.title ?? null)
      .catch(() => null));

  // Sans titre, le slug est indevinable. On a déjà purgé ce qu'on pouvait ;
  // la fenêtre de `revalidate` rattrapera le reste.
  if (!resolved) return;

  revalidatePath(listingUrl(id, resolved));
}

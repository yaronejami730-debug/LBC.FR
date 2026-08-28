import { permanentRedirect } from "next/navigation";
import Parent, { generateMetadata as parentMetadata } from "../../page";

/**
 * Pages 2 et suivantes de la liste — même écran, numéro porté par le chemin.
 *
 * ── Pourquoi une route enfant plutôt qu'un `?page=` ────────────────────────
 *
 * Lire `searchParams` dans un composant serveur bascule la route en rendu
 * dynamique, et ce basculement est silencieux : le `revalidate` déclaré deux
 * lignes plus haut dans la page parente cesse simplement de s'appliquer. Next
 * répond alors `cache-control: private, no-cache, no-store`, qui écrase
 * l'en-tête public déclaré pour ces chemins dans `next.config.ts`.
 *
 * Le coût est mesuré : sur les 362 URL du crawl d'audit, `MISS 284, HIT 75`.
 * Chaque passage de Googlebot rejouait le rendu et ses requêtes Prisma à
 * l'origine, ce qui saturait le pool de connexions et produisait les délais
 * d'attente relevés le 11/08 — y compris sur des pages qui n'interrogent rien.
 *
 * Porter le numéro par le chemin rend son URL de base entièrement statique :
 * la page 1, celle que Google explore et indexe, n'a plus rien à lire.
 *
 * ── Ce que fait ce fichier, et rien d'autre ───────────────────────────────
 *
 * Il ne duplique aucun rendu : la page parente accepte déjà `numero` dans ses
 * `params` et porte l'intégralité de l'écran, métadonnées comprises. Deux
 * gabarits pour une même liste divergeraient, comme l'ont fait `PAIRS` et
 * `COMPARATIF_MATCH` avant d'être réunis.
 *
 * Il ne déclare pas non plus `dynamicParams = false`, que la page parente
 * porte parfois : les numéros de page ne sont pas énumérables à la
 * construction, et les prérendre tous reviendrait à figer la profondeur d'une
 * liste qui bouge à chaque annonce publiée. Ils sont rendus à la demande, puis
 * mis en cache par le CDN comme n'importe quelle autre URL.
 */
export const revalidate = 3600;

/**
 * `/page/1` est une seconde adresse pour la page 1 : c'est du contenu dupliqué
 * que Google devrait canonicaliser lui-même. On tranche à la source, en 308 —
 * une redirection permanente qui préserve la méthode HTTP.
 *
 * Même traitement pour un numéro illisible (`/page/abc`, `/page/-1`) :
 * `parsePageParam` le ramènerait à 1, ce qui donnerait deux URL rendant le
 * même écran. La redirection le dit explicitement plutôt que de le laisser
 * passer.
 */
function redirectIfFirstPage(numero: string, base: string) {
  const parsed = Number.parseInt(numero, 10);
  if (!Number.isFinite(parsed) || parsed <= 1) permanentRedirect(base);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tranche: string; numero: string }>;
}) {
  return parentMetadata({ params });
}

export default async function VoitureBudgetPagedPage({
  params,
}: {
  params: Promise<{ tranche: string; numero: string }>;
}) {
  const resolved = await params;
  redirectIfFirstPage(resolved.numero, `/voiture-budget/${resolved.tranche}`);
  return <Parent params={Promise.resolve(resolved)} />;
}

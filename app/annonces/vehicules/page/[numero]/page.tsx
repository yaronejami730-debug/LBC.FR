import { permanentRedirect } from "next/navigation";
import Parent, { generateMetadata as parentMetadata } from "../../../[categorie]/page";

/**
 * Pages 2 et suivantes de `/annonces/vehicules`.
 *
 * ── Pourquoi cette route existe séparément ────────────────────────────────
 *
 * `/annonces/vehicules` est rendu par `app/annonces/[categorie]/page.tsx`,
 * comme les autres catégories. Mais le dossier `app/annonces/vehicules/`
 * existe pour porter les pages de marque et de modèle, et un segment
 * **statique** l'emporte sur un segment dynamique dans la résolution de Next.
 *
 * Conséquence : `/annonces/vehicules/page/2` n'atteint jamais
 * `app/annonces/[categorie]/page/[numero]`. Il descend dans le dossier
 * `vehicules/`, où `page` est lu comme un nom de marque et `2` comme un
 * modèle — d'où le 404 mesuré, alors que `/annonces/mode/page/2` répondait
 * 200. Une seule catégorie sur onze était touchée, précisément celle qui porte
 * le plus de stock.
 *
 * Ce fichier remet la catégorie véhicules sur le même rendu que les autres. Il
 * ne duplique rien : c'est la page parente qui rend l'écran, ici comme
 * ailleurs.
 *
 * ⚠️ Toute catégorie qui recevrait un jour son propre dossier statique sous
 * `app/annonces/` aura besoin du même fichier, pour la même raison.
 */
export const revalidate = 3600;

/**
 * La route doit être *prérendable* pour que le CDN la garde.
 *
 * Une route marquée `ƒ (Dynamic)` ignore les en-têtes de `next.config.ts` :
 * Next pose les siens après, et `private, no-cache, no-store` l'emporte.
 * Mesuré en production le 28/08/2026 — la règle d'en-tête déclarée pour ces
 * chemins ne s'appliquait qu'aux pages prérendues, sans que rien ne le dise.
 *
 * La liste est vide : il n'y a rien à prérendre à la construction, et figer
 * des numéros de page au build reviendrait à figer la profondeur d'une liste
 * qui bouge à chaque annonce publiée. `dynamicParams` reste à sa valeur par
 * défaut : chaque page est rendue à la demande, puis mise en cache.
 */
export function generateStaticParams() {
  return [];
}


export async function generateMetadata({
  params,
}: {
  params: Promise<{ numero: string }>;
}) {
  const { numero } = await params;
  return parentMetadata({ params: Promise.resolve({ categorie: "vehicules", numero }) });
}

export default async function VehiculesPagedPage({
  params,
}: {
  params: Promise<{ numero: string }>;
}) {
  const { numero } = await params;

  // `/page/1` est une seconde adresse pour la page 1 : on tranche en 308 plutôt
  // que de laisser Google canonicaliser deux URL rendant le même écran. Même
  // traitement pour un numéro illisible, que `parsePageParam` ramènerait à 1.
  const parsed = Number.parseInt(numero, 10);
  if (!Number.isFinite(parsed) || parsed <= 1) permanentRedirect("/annonces/vehicules");

  return <Parent params={Promise.resolve({ categorie: "vehicules", numero })} />;
}

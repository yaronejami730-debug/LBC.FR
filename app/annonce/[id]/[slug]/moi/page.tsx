import { auth } from "@/lib/auth";
import { ListingView } from "../page";

/**
 * La même fiche d'annonce, rendue **avec** la session.
 *
 * Cette route n'est jamais tapée : le middleware y réécrit les requêtes vers
 * `/annonce/:id/:slug` qui portent un cookie de session. L'URL affichée dans le
 * navigateur ne change pas, et l'adresse canonique reste celle de la fiche.
 *
 * ── Pourquoi une seconde route plutôt qu'une condition ────────────────────
 *
 * Le besoin est de servir deux rendus différents selon qu'il y a une session ou
 * non, et de ne payer le rendu dynamique que dans le second cas. Une condition
 * dans la page ne le permet pas : décider s'il y a une session suppose de lire
 * un cookie, et lire un cookie suffit à rendre la route dynamique **pour tout
 * le monde**, y compris pour le visiteur anonyme qu'on cherchait à épargner.
 *
 * Le middleware, lui, lit les cookies sans engager le rendu. Il fait donc le
 * seul aiguillage qui n'ait pas de coût : anonyme → page statique servie par le
 * CDN, connecté → cette route-ci.
 *
 * Ce qui suppose que la vue elle-même reste unique. `ListingView` est le corps
 * de la fiche, importé des deux côtés ; il n'existe pas deux gabarits à tenir
 * en phase. Les contrôles de droits — annonce supprimée, statut non
 * `APPROVED` — vivent dedans et s'appliquent donc identiquement aux deux
 * entrées : c'est la session reçue qui change, jamais la règle.
 */
export const dynamic = "force-dynamic";

/**
 * `noindex` — ceinture et bretelles avec le `Disallow` de `robots.ts`.
 *
 * Cette adresse rend le même écran que la fiche publique. Elle n'est émise
 * nulle part et n'est atteinte que par réécriture du middleware, mais elle
 * reste tapable : indexée, elle serait un doublon parfait de chaque annonce.
 *
 * Les deux protections ne se recouvrent pas. `robots.txt` empêche
 * l'exploration mais pas l'indexation d'une URL découverte ailleurs — un lien
 * externe, une barre d'adresse partagée. `noindex` ferme ce cas-là. Et comme
 * une page interdite au crawl ne peut pas être lue, l'inverse est vrai aussi :
 * il faut les deux pour couvrir les deux chemins.
 */
export const metadata = {
  robots: { index: false, follow: true },
};

export default async function ListingPagePersonalised({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const session = await auth();
  return <ListingView params={params} session={session} />;
}

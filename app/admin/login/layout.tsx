import type { Metadata } from "next";

/**
 * Porte d'entrée de l'administration — jamais dans un index.
 *
 * Elle répondait `index, follow` en production le 19/08/2026 : la page est un
 * composant client, elle ne pouvait donc pas exporter de `metadata`, et elle
 * héritait du `robots: { index: true }` du layout racine. Ce layout, qui
 * n'ajoute aucun rendu, existe uniquement pour porter la balise.
 *
 * `robots.txt` ferme déjà `/admin` à l'exploration, ce qui rend cette balise
 * invisible pour Googlebot — il ne peut pas lire ce qu'il n'a pas le droit de
 * récupérer. Les deux ne font pas double emploi pour autant : une URL bloquée
 * au crawl peut encore être indexée sur la seule foi de liens externes, sans
 * contenu. Le `noindex` est la protection qui prend le relais le jour où le
 * blocage tombe, volontairement ou par accident.
 *
 * `nofollow` en plus d'`index: false` : les liens d'un écran de connexion ne
 * mènent qu'à des espaces privés, aucun n'a de valeur à transmettre.
 */
export const metadata: Metadata = {
  title: "Connexion administration — Deal&Co",
  robots: { index: false, follow: false },
};

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}

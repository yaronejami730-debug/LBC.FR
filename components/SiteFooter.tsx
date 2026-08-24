import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { TOP_CITIES } from "@/lib/cities";
import { getSeoInventory, isIndexable } from "@/lib/seo/inventory";
import { getIndexablePriceSlugs } from "@/lib/seo/price";

const LEGAL_LINKS = [
  { label: "À propos", href: "/a-propos" },
  { label: "Blog", href: "/blog" },
  { label: "Deal&Co Info", href: "/actualites" },
  { label: "Deal&Co Auto", href: "/actualites/auto" },
  { label: "Contact", href: "/contact" },
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "CGU", href: "/cgu" },
  { label: "Politique de confidentialité", href: "/confidentialite" },
  { label: "API", href: "/api-doc" },
];

const POPULAR_QUERIES = [
  { label: "Renault Clio occasion", href: "/prix/renault-clio-occasion" },
  { label: "Peugeot 208 occasion", href: "/prix/peugeot-208-occasion" },
  { label: "BMW Série 3 occasion", href: "/prix/bmw-serie-3-occasion" },
  { label: "iPhone 14 occasion", href: "/prix/iphone-14-occasion" },
  { label: "iPhone 13 occasion", href: "/prix/iphone-13-occasion" },
  { label: "Canapé Ikea occasion", href: "/prix/canape-ikea-occasion" },
  { label: "Vélo occasion", href: "/prix/velo-occasion" },
  { label: "Volkswagen Golf occasion", href: "/prix/volkswagen-golf-occasion" },
];

const FOOTER_CATEGORIES = CATEGORIES.slice(0, 14);

/**
 * Le pied de page est présent sur **toutes** les pages du site : c'est de loin
 * le premier émetteur de liens du domaine, et le premier chemin qu'un crawler
 * emprunte. Deux blocs y pointaient vers des pages qui n'existent pas toujours.
 *
 *   — « Annonces par ville » listait vingt-quatre villes en dur, alors que
 *     `/ville/{slug}` répond 404 dès qu'une ville n'a aucune annonce. Vingt-
 *     quatre liens potentiellement morts, répétés sur chaque page du site : le
 *     candidat le plus vraisemblable aux 55 « Introuvables (404) » de Search
 *     Console.
 *
 *   — « Recherches populaires » listait huit pages de cote choisies à la main,
 *     dont certaines n'ont pas assez d'observations pour exister.
 *
 * Les deux blocs sont désormais filtrés sur l'état réel. Ils rétrécissent quand
 * le stock est maigre — c'est le comportement voulu : mieux vaut huit liens
 * vivants que trente-deux dont la moitié renvoie une erreur.
 */
export default async function SiteFooter() {
  const [inv, priceSlugs] = await Promise.all([
    getSeoInventory().catch(() => null),
    getIndexablePriceSlugs().catch(() => [] as string[]),
  ]);

  const footerCities = inv
    ? TOP_CITIES.filter((c) => isIndexable(inv.byCity[c.slug] ?? 0)).slice(0, 24)
    : [];

  const popularQueries = POPULAR_QUERIES.filter((q) =>
    priceSlugs.includes(q.href.replace("/prix/", "")),
  );

  /**
   * Colonnes réellement affichées.
   *
   * Le filtrage des liens morts vidait des colonnes sans retirer leur titre :
   * « Recherches populaires » s'affichait au-dessus de rien, et « Annonces par
   * ville » gardait sa grille à deux colonnes pour trois villes. Un titre sans
   * lien en dessous ressemble à une page cassée — alors que le stock est
   * simplement maigre. On ne rend donc que les colonnes qui ont quelque chose
   * à montrer, et la grille se resserre sur ce qui reste.
   */
  const sections: {
    title: string;
    /** Liste sur deux colonnes dès qu'elle est longue (villes uniquement). */
    dense?: boolean;
    links: { label: string; href: string; title: string }[];
  }[] = [
    {
      title: "Catégories populaires",
      links: FOOTER_CATEGORIES.map((c) => ({
        label: c.label,
        href: `/annonces/${c.id}`,
        title: `Annonces ${c.label}`,
      })),
    },
    {
      title: "Annonces par ville",
      dense: true,
      links: footerCities.map((city) => ({
        label: city.name,
        href: `/ville/${city.slug}`,
        title: `Annonces à ${city.name}`,
      })),
    },
    {
      title: "Recherches populaires",
      links: popularQueries.map((q) => ({
        label: q.label,
        href: q.href,
        title: `Voir les prix : ${q.label}`,
      })),
    },
    {
      title: "Deal&Co",
      links: [
        ...LEGAL_LINKS.map((l) => ({ label: l.label, href: l.href, title: l.label })),
        { label: "Dernières annonces", href: "/nouveautes", title: "Dernières annonces publiées" },
        { label: "Publier une annonce", href: "/post", title: "Publier une annonce gratuite" },
      ],
    },
  ].filter((s) => s.links.length > 0);

  // Tailwind ne voit que des classes écrites en entier : pas de `grid-cols-${n}`.
  const gridCols =
    sections.length >= 4 ? "md:grid-cols-4" : sections.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2";

  return (
    <footer className="bg-white border-t border-slate-200 mt-12">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className={`grid grid-cols-2 ${gridCols} gap-8 mb-10`}>
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-extrabold text-on-surface uppercase tracking-wider mb-3 font-['Manrope']">
                {section.title}
              </h3>
              {/* Deux colonnes seulement quand la liste est assez longue pour
                  que ça se voie : à trois villes, la seconde colonne laissait un
                  trou au milieu du pied de page. */}
              <ul className={section.dense && section.links.length >= 10 ? "grid grid-cols-2 gap-x-2 gap-y-1.5" : "space-y-1.5"}>
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      title={link.title}
                      className="text-xs text-slate-500 hover:text-[#2f6fb8] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">
            © 2026 Deal&amp;Co — Petites annonces gratuites entre particuliers et professionnels
          </p>
          <nav className="flex items-center flex-wrap justify-center gap-1">
            {LEGAL_LINKS.map((link, i) => (
              <span key={link.href} className="flex items-center">
                {i > 0 && <span className="text-slate-300 mx-2 select-none">·</span>}
                <Link
                  href={link.href}
                  title={link.label}
                  className="text-[11px] text-slate-400 hover:text-[#2f6fb8] transition-colors"
                >
                  {link.label}
                </Link>
              </span>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

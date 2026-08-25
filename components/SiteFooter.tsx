import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { TOP_CITIES } from "@/lib/cities";
import { getSeoInventory, isIndexable } from "@/lib/seo/inventory";
import { getIndexablePriceSlugs } from "@/lib/seo/price";

/**
 * Le pied de page.
 *
 * ── Ce qui n'allait pas, et qui est corrigé ici ───────────────────────────
 *
 * Le pied de page est présent sur **toutes** les pages du site : c'est de loin
 * le premier émetteur de liens du domaine, et le premier chemin qu'un crawler
 * emprunte. Il avait trois défauts, et les trois se voyaient à l'œil nu.
 *
 *   1. **Les neuf liens légaux et éditoriaux étaient rendus deux fois** — une
 *      fois dans la colonne « Deal&Co », une seconde dans la barre du bas.
 *      Dix-huit liens pour neuf destinations, sur chaque page du site. Un
 *      lecteur y lit du remplissage ; un moteur y lit un maillage qui se
 *      répète sans rien dire de plus.
 *
 *   2. **Une colonne fourre-tout.** « À propos », « CGU », « API »,
 *      « Publier une annonce » et « Deal&Co Info » cohabitaient sous un même
 *      titre. Ces cinq liens ne répondent pas à la même question : qui êtes-
 *      vous, à quoi je m'engage, comment je m'en sers, qu'est-ce que je peux
 *      faire. Un intitulé de colonne doit annoncer une intention.
 *
 *   3. **Aucune hiérarchie entre le maillage et la navigation.** Les liens de
 *      référencement — catégories, villes, cotes — avaient le même poids
 *      visuel que « Contact ». Ils n'ont ni le même destinataire ni le même
 *      rôle : les premiers travaillent pour un moteur, les seconds répondent à
 *      un visiteur qui cherche quelque chose de précis.
 *
 * ── L'organisation retenue ────────────────────────────────────────────────
 *
 * Quatre colonnes, une intention par colonne — qui nous sommes, ce à quoi vous
 * vous engagez, ce que le site sait faire, où trouver de l'aide. Puis, en
 * dessous et visuellement en retrait, la bande de maillage : catégories,
 * villes, recherches. Puis la barre de bas de page, qui ne répète plus rien.
 *
 * ── Ce que ce pied de page ne fera jamais ─────────────────────────────────
 *
 * Pointer vers une page qui n'existe pas. Les villes et les cotes sont filtrées
 * sur l'état réel du stock : `/ville/{slug}` répond 404 dès qu'une ville n'a
 * aucune annonce, et vingt-quatre liens morts répétés sur chaque page du site
 * étaient le candidat le plus vraisemblable aux 55 « Introuvables (404) » de
 * Search Console. Les blocs rétrécissent donc quand le stock est maigre — mieux
 * vaut huit liens vivants que trente-deux dont la moitié échoue.
 *
 * Et il n'affichera pas non plus de comptes sociaux, de note Trustpilot ou de
 * badges d'application tant que ces choses n'existent pas. Un pied de page qui
 * annonce ce que le site n'a pas est le premier endroit où un visiteur cesse
 * de croire le reste.
 */

/** Les colonnes fixes, une intention par colonne. */
const COLUMNS: { title: string; links: { label: string; href: string; title: string }[] }[] = [
  {
    title: "À propos de Deal&Co",
    links: [
      { label: "Qui sommes-nous", href: "/a-propos", title: "À propos de Deal&Co" },
      { label: "Le blog", href: "/blog", title: "Guides pratiques pour acheter et vendre" },
      { label: "Deal&Co Info", href: "/actualites", title: "L'actualité du jour, mise à jour en continu" },
      { label: "Deal&Co Auto", href: "/actualites/auto", title: "L'actualité automobile et les cotes d'occasion" },
    ],
  },
  {
    title: "Informations légales",
    links: [
      { label: "Mentions légales", href: "/mentions-legales", title: "Mentions légales" },
      { label: "Conditions générales d'utilisation", href: "/cgu", title: "CGU de Deal&Co" },
      { label: "Politique de confidentialité", href: "/confidentialite", title: "Données personnelles et cookies" },
    ],
  },
  {
    title: "Nos services",
    links: [
      { label: "Publier une annonce", href: "/post", title: "Publier une annonce gratuite" },
      { label: "Dernières annonces", href: "/nouveautes", title: "Les annonces publiées aujourd'hui" },
      { label: "Toutes les catégories", href: "/annonces", title: "Parcourir toutes les catégories" },
      { label: "Vendre entre particuliers", href: "/vente-objets-occasion-particuliers", title: "Vendre ses objets d'occasion" },
      { label: "Comparatifs auto", href: "/comparatif", title: "Comparer deux modèles d'occasion" },
      { label: "Voiture par budget", href: "/voiture-budget", title: "Voitures d'occasion par tranche de prix" },
    ],
  },
  {
    title: "Aide et outils",
    links: [
      // `/support` n'a pas sa place ici : le middleware le range dans
      // `PROTECTED` et le renvoie vers `/login?callbackUrl=…`. Un lien de pied
      // de page qui mène à un formulaire de connexion sur chaque page du site
      // est exactement l'espace d'URL infini que `robots.ts` bloque par
      // ailleurs. Qui n'est pas connecté passe par « Nous contacter ».
      { label: "Nous contacter", href: "/contact", title: "Écrire à l'équipe Deal&Co" },
      { label: "API développeurs", href: "/api-doc", title: "Documentation de l'API Deal&Co" },
      { label: "Flux d'actualité", href: "/actualites/feed.xml", title: "S'abonner au flux Atom de Deal&Co Info" },
    ],
  },
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

export default async function SiteFooter() {
  /**
   * La verticale Pet est derrière un drapeau : `middleware.ts` renvoie tout
   * `/pet*` vers `/_pet-disabled` tant que `PET_PUBLIC` ne vaut pas `"true"`.
   * Le lien suivait donc l'état du drapeau, pas une liste écrite en dur — sans
   * quoi le pied de page annonce sur chaque page du site une rubrique qui
   * répond 404.
   */
  const petPublic = process.env.PET_PUBLIC === "true";

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
   * La bande de maillage.
   *
   * Elle est rendue en puces plutôt qu'en colonnes : quarante-six liens en
   * listes verticales occupaient la moitié de la hauteur du pied de page pour
   * un rôle qui est d'abord celui d'un maillage. Une rangée de puces dit la
   * même chose en quatre lignes.
   *
   * Un groupe vide ne laisse pas son titre derrière lui — un intitulé au-dessus
   * de rien ressemble à une page cassée, alors que le stock est simplement
   * maigre.
   */
  const seoGroups = [
    {
      title: "Catégories",
      links: FOOTER_CATEGORIES.map((c) => ({
        label: c.label,
        href: `/annonces/${c.id}`,
        title: `Annonces ${c.label}`,
      })),
    },
    {
      title: "Villes",
      links: footerCities.map((city) => ({
        label: city.name,
        href: `/ville/${city.slug}`,
        title: `Annonces à ${city.name}`,
      })),
    },
    {
      title: "Recherches fréquentes",
      links: popularQueries.map((q) => ({
        label: q.label,
        href: q.href,
        title: `Voir les prix : ${q.label}`,
      })),
    },
  ].filter((g) => g.links.length > 0);

  const columns = COLUMNS.map((column) =>
    column.title === "Nos services" && petPublic
      ? {
          ...column,
          links: [
            ...column.links,
            { label: "Garde d'animaux", href: "/pet", title: "Trouver une garde pour son animal" },
          ],
        }
      : column,
  );

  return (
    <footer className="mt-12 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* ── Les quatre intentions ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4">
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="border-b border-slate-200 pb-2 font-['Manrope'] text-[13px] font-extrabold uppercase tracking-wider text-on-surface">
                {column.title}
              </h3>
              <ul className="mt-3 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      title={link.title}
                      className="text-[13px] leading-snug text-slate-600 transition-colors hover:text-[#2f6fb8]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* ── Le maillage, volontairement en retrait ─────────────────────── */}
        {seoGroups.length > 0 && (
          <div className="mt-10 space-y-3 border-t border-slate-100 pt-8">
            {seoGroups.map((group) => (
              <div key={group.title} className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-4">
                <h3 className="shrink-0 font-['Manrope'] text-[11px] font-bold uppercase tracking-wider text-slate-400 sm:w-40">
                  {group.title}
                </h3>
                <ul className="flex flex-wrap items-baseline gap-x-1 gap-y-1.5">
                  {group.links.map((link, i) => (
                    <li key={link.href} className="flex items-baseline">
                      {i > 0 && <span className="mx-1.5 select-none text-slate-300">·</span>}
                      <Link
                        href={link.href}
                        title={link.title}
                        className="text-xs text-slate-500 transition-colors hover:text-[#2f6fb8]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* ── La barre de bas de page ────────────────────────────────────────
            Elle ne répète plus les liens des colonnes. Ce qu'elle porte est ce
            qu'elle est seule à pouvoir dire : qui édite le site, et depuis
            quand. */}
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-6 sm:flex-row">
          <p className="text-[11px] text-slate-400">
            © 2026 Deal&amp;Co — Petites annonces gratuites entre particuliers et
            professionnels
          </p>
          <p className="text-[11px] text-slate-400">
            Annonces publiées par leurs auteurs · Revue de presse attribuée à ses
            sources
          </p>
        </div>
      </div>
    </footer>
  );
}

/**
 * Page d'acquisition vendeurs : « vente d'objets d'occasion entre particuliers ».
 *
 * Elle ne double pas `/annonces`, et la distinction n'est pas cosmétique :
 * `/annonces` s'adresse à qui **cherche** — catégories, sous-catégories,
 * villes, c'est un hub de navigation. Celle-ci s'adresse à qui **vend**, et
 * mène à un seul endroit : le dépôt d'annonce. Deux intentions, deux pages,
 * un lien croisé entre les deux pour que Google sache laquelle répond à quoi.
 *
 * Le contenu est adossé aux données réelles — nombre d'annonces d'objets,
 * catégories peuplées, villes actives. Une page d'acquisition qui annonce des
 * chiffres inventés se fait démentir par sa propre grille d'annonces.
 */
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/categories";
import { FRENCH_CITIES } from "@/lib/cities";
import { getSeoInventory, isIndexable } from "@/lib/seo/inventory";
import { buildPageMetadata, SITE_URL } from "@/lib/seo/metadata";
import { safeJsonLd } from "@/lib/json-ld";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import ListingCard from "@/components/home/ListingCard";

export const revalidate = 3600;

const PATH = "/vente-objets-occasion-particuliers";

/**
 * Catégories d'objets, au sens du mot-clé.
 *
 * Un appartement et un poste de développeur ne sont pas des « objets
 * d'occasion » : les inclure ferait mentir le titre et diluerait la page.
 * Immobilier, véhicules, services, emploi, animaux et vacances restent donc
 * dehors — chacun a déjà sa propre porte d'entrée.
 */
const OBJECT_CATEGORY_IDS = [
  "maison",
  "multimedia",
  "mode",
  "loisirs",
  "bebe-enfant",
  "materiel-pro",
  "divers",
] as const;

const OBJECT_CATEGORY_LABELS = [
  "Maison",
  "Multimédia",
  "Mode",
  "Loisirs",
  "Bébé & Enfant",
  "Matériel professionnel",
  "Divers",
];

/**
 * Teinte de la vignette de chaque catégorie.
 *
 * Reprise des `oklch(93% 0.03 …)` de la maquette, converties en hexadécimal
 * pour rester lisibles à côté des jetons du site. Elles ne portent aucune
 * information — deux catégories voisines n'ont pas de lien parce qu'elles sont
 * proches en teinte — elles servent uniquement à ce que la grille respire.
 */
const CATEGORY_TINT: Record<string, string> = {
  maison: "#dbe8f7",
  multimedia: "#d7ecf3",
  loisirs: "#dfe3f8",
  mode: "#f5dfeb",
  divers: "#e4e8ed",
  "materiel-pro": "#f4e8d2",
  "bebe-enfant": "#f8e1dd",
};

const CONSEILS = [
  {
    titre: "Fixez le bon prix dès le départ",
    texte:
      "Regardez ce que le même objet part réellement dans les annonces en ligne, pas ce qu'il a coûté neuf. Un prix 20 % au-dessus du marché double le délai de vente ; un prix légèrement en dessous fait venir plusieurs acheteurs, et c'est là qu'on négocie en position de force.",
  },
  {
    titre: "Photographiez à la lumière du jour",
    texte:
      "Cinq photos nettes sur fond neutre valent mieux qu'une vue floue prise le soir. Montrez l'objet sous plusieurs angles, et montrez aussi les défauts : une rayure annoncée fait gagner du temps, une rayure découverte à la remise fait annuler la vente.",
  },
  {
    titre: "Écrivez ce que l'acheteur cherche",
    texte:
      "Marque, modèle, dimensions, année, état, raison de la vente. Un titre qui nomme précisément l'objet ressort dans la recherche ; « lot à vendre » n'est trouvé par personne.",
  },
  {
    titre: "Répondez vite, et sur la plateforme",
    texte:
      "Les premières heures font la vente. Gardez les échanges dans la messagerie du site : c'est ce qui vous protège si l'acheteur se rétracte ou si la conversation part vers un moyen de paiement douteux.",
  },
];

const FAQ = [
  {
    q: "La vente d'objets d'occasion entre particuliers est-elle vraiment gratuite ?",
    a: "Oui. Le dépôt d'annonce est gratuit et Deal&Co ne prélève aucune commission sur la vente : le prix affiché est celui que vous encaissez. Seules les options de mise en avant, facultatives, sont payantes.",
  },
  {
    q: "Quels objets peut-on vendre entre particuliers ?",
    a: "Mobilier, électroménager, téléphones et informatique, vêtements, vélos, jouets, matériel de bricolage, articles de puériculture, équipement professionnel. Sont interdits les produits contrefaits, les animaux vivants hors cadre légal, les armes, les médicaments et tout bien dont la revente est encadrée par la loi.",
  },
  {
    q: "Comment fixer le prix d'un objet d'occasion ?",
    a: "Partez du prix auquel des objets comparables se vendent aujourd'hui, puis retirez selon l'état, l'âge et les accessoires manquants. Pour un objet courant de moins de trois ans en bon état, la fourchette observée se situe souvent entre 40 et 60 % du prix neuf.",
  },
  {
    q: "Faut-il déclarer les ventes d'objets d'occasion aux impôts ?",
    a: "La revente d'un bien personnel d'occasion à un prix inférieur à son prix d'achat n'est pas imposable, sauf pour les métaux précieux, les bijoux et les objets d'art et de collection au-delà de 5 000 €. Une activité d'achat-revente régulière relève, elle, d'un régime professionnel.",
  },
];

const TITLE = "Vente d'objets d'occasion entre particuliers – Deal&Co";
const DESCRIPTION =
  "Vendez vos objets d'occasion entre particuliers sur Deal&Co : dépôt d'annonce gratuit, sans commission. Mobilier, électronique, mode, loisirs.";

export const metadata = {
  ...buildPageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH }),
  // Le layout racine applique « %s | Deal&Co » à tout titre de page. Ce titre
  // porte déjà la marque : sans `absolute`, Google reçoit « … – Deal&Co |
  // Deal&Co » et tronque la partie utile.
  title: { absolute: TITLE },
};

export default async function VenteObjetsOccasionPage() {
  const inventory = await getSeoInventory().catch(() => null);

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where: {
        status: "APPROVED",
        deletedAt: null,
        shadowBanned: false,
        category: { in: OBJECT_CATEGORY_LABELS },
      } as never,
      orderBy: [{ isPremium: "desc" }, { createdAt: "desc" }],
      take: 8,
      select: {
        id: true,
        title: true,
        price: true,
        location: true,
        images: true,
        createdAt: true,
        isPremium: true,
      },
    }),
    prisma.listing.count({
      where: {
        status: "APPROVED",
        deletedAt: null,
        shadowBanned: false,
        category: { in: OBJECT_CATEGORY_LABELS },
      } as never,
    }),
  ]);

  // Catégories d'objets, les plus fournies d'abord. Une catégorie vide reste
  // affichée — elle sert l'appel à publier — mais après les autres.
  const categories = CATEGORIES.filter((c) =>
    (OBJECT_CATEGORY_IDS as readonly string[]).includes(c.id),
  )
    .map((c) => ({ ...c, count: inventory?.byCategory[c.id] ?? 0 }))
    .sort((a, b) => b.count - a.count);

  // Villes réellement actives, jamais une liste décorative : un lien vers une
  // page vide coûte du budget d'exploration et déçoit le visiteur.
  const cityBySlug = new Map(FRENCH_CITIES.map((c) => [c.slug, c]));
  const cities = Object.entries(inventory?.byCity ?? {})
    .filter(([slug, count]) => isIndexable(count) && cityBySlug.has(slug))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([slug, count]) => ({ slug, count, name: cityBySlug.get(slug)!.name }));

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Vente d'objets d'occasion entre particuliers",
        item: `${SITE_URL}${PATH}`,
      },
    ],
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="vo">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqLd) }} />
      {/* Feuille de style transcrite de la maquette Claude Design.
          Les valeurs — tailles, graisses, marges, rayons, couleurs oklch — sont
          reprises telles quelles plutôt que rapprochées des jetons du site :
          c'est la maquette qui fait foi ici, et l'approcher « à peu près »
          produisait exactement le rendu qu'elle corrigeait. Les seuls ajouts
          sont les points de rupture, absents d'une maquette conçue en 1200 px. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
/* Palette du site (tailwind.config.ts), géométrie de la maquette.
   Les rôles sont ceux de la maquette — fond, carte, survol, filet, trois
   niveaux de texte, accent — mais chaque valeur est un jeton Deal&Co, pour que
   la page ne détonne pas entre la barre de navigation et le pied de page. */
.vo {
  --bg: #f7f9fb;          /* surface */
  --card: #ffffff;        /* surface-container-lowest */
  --hover: #f2f4f6;       /* surface-container-low */
  --line: #e2e4ea;        /* outline-variant éclairci : filet, pas trait */
  --ink: #191c1e;         /* on-surface */
  --ink2: #464652;        /* on-surface-variant */
  --muted: #777683;       /* outline */
  --faint: #c7c5d4;       /* outline-variant */
  --accent: #2f6fb8;      /* primary */
  --accent-dark: #1a5a9e; /* primary-container */
  --dark: #2d3133;        /* inverse-surface */
  --dark-accent: #3adfab; /* tertiary-fixed-dim */
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  background: var(--bg);
  color: var(--ink);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}
/* Manrope sur les titres et les grands nombres, comme partout ailleurs. */
.vo-h1, .vo-h2, .vo-stat dt, .vo-step b { font-family: Manrope, sans-serif; }
.vo-wrap { max-width: 1120px; margin: 0 auto; padding: 0 32px; }
.vo-top { padding-top: 128px; padding-bottom: 64px; }
.vo-mid { padding-top: 24px; padding-bottom: 88px; }

.vo-eyebrow { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; color: var(--accent); }
.vo-h1 { font-size: 52px; line-height: 1.12; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 28px; max-width: 780px; }
.vo-h1 span { color: var(--ink2); font-weight: 500; }
.vo-lead { font-size: 19px; line-height: 1.6; color: var(--ink2); max-width: 640px; margin: 0 0 40px; }
.vo-h2 { font-size: 32px; font-weight: 700; letter-spacing: -0.01em; margin: 0 0 40px; }
.vo-h2.tight { margin-bottom: 16px; }
.vo-sub { font-size: 16px; line-height: 1.6; color: var(--ink2); max-width: 620px; margin: 0 0 40px; }

.vo-cta {
  display: inline-flex; align-items: center; gap: 10px;
  background: var(--accent); color: #fff; border: none; border-radius: 100px;
  padding: 16px 28px; font-size: 16px; font-weight: 600; cursor: pointer;
  box-shadow: 0 8px 20px -8px rgba(47, 111, 184, 0.35);
  transition: background .2s ease;
}
.vo-cta:hover { background: var(--accent-dark); }
.vo-ghost {
  display: inline-flex; align-items: center;
  background: transparent; color: var(--ink);
  border: 1.5px solid var(--line); border-radius: 100px;
  padding: 16px 28px; font-size: 16px; font-weight: 600;
  transition: border-color .2s ease, background .2s ease;
}
.vo-ghost:hover { border-color: var(--ink); background: var(--card); }

.vo-card { border: 1px solid var(--line); border-radius: 20px; background: var(--card); overflow: hidden; }
.vo-g3 { display: grid; grid-template-columns: repeat(3, 1fr); }
.vo-g4 { display: grid; grid-template-columns: repeat(4, 1fr); }
.vo-g3 > * + *, .vo-g4 > * { border-left: 1px solid var(--line); }
.vo-g4 > *:nth-child(4n + 1) { border-left: none; }
.vo-g4 > *:nth-child(n + 5) { border-top: 1px solid var(--line); }

.vo-stat { padding: 32px 24px; text-align: center; }
.vo-stat dt { font-size: 34px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 8px; font-variant-numeric: tabular-nums; }
.vo-stat dd { margin: 0; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; color: var(--muted); text-transform: uppercase; }

.vo-step { padding: 40px 36px; }
.vo-step b { display: block; font-size: 40px; font-weight: 700; color: var(--faint); letter-spacing: -0.02em; margin-bottom: 20px; }
.vo-step strong { display: block; font-size: 18px; font-weight: 700; margin-bottom: 10px; }
.vo-step span { font-size: 15px; line-height: 1.6; color: var(--ink2); }

.vo-cat { display: block; padding: 32px 28px; text-decoration: none; color: inherit; transition: background .2s ease; }
.vo-cat:hover { background: var(--hover); }
.vo-tile {
  width: 36px; height: 36px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 20px; color: var(--accent-dark);
}
.vo-cat b { display: block; font-size: 16px; font-weight: 700; margin-bottom: 4px; }
.vo-cat span { font-size: 14px; color: var(--ink2); }
.vo-cat span.empty { color: var(--muted); }

.vo-dark { background: var(--dark); color: #fff; }
.vo-dark .vo-eyebrow { color: var(--dark-accent); }
.vo-dark .vo-h2 { margin-bottom: 40px; }
.vo-arg { border-top: 1px solid rgba(255, 255, 255, 0.16); padding-top: 24px; }
.vo-arg strong { display: block; font-size: 18px; font-weight: 700; margin-bottom: 10px; }
.vo-arg span { font-size: 15px; line-height: 1.6; color: rgba(255, 255, 255, 0.66); }

.vo-row { border-top: 1px solid var(--line); padding: 32px 0; }
.vo-row:last-child { border-bottom: 1px solid var(--line); }
.vo-row h3 { font-size: 18px; font-weight: 700; margin: 0 0 10px; }
.vo-row p { font-size: 15px; line-height: 1.6; color: var(--ink2); margin: 0; max-width: 640px; }
.vo-num { font-size: 15px; font-weight: 700; color: var(--faint); font-variant-numeric: tabular-nums; }

.vo-faq summary::-webkit-details-marker { display: none; }
.vo-faq summary { list-style: none; }

@media (max-width: 900px) {
  .vo-wrap { padding: 0 20px; }
  .vo-top { padding-top: 112px; }
  .vo-h1 { font-size: 34px; line-height: 1.14; }
  .vo-lead { font-size: 17px; }
  .vo-h2 { font-size: 26px; }
  .vo-g3, .vo-g4 { grid-template-columns: repeat(2, 1fr); }
  .vo-g3 > *, .vo-g4 > * { border-left: none; border-top: 1px solid var(--line); }
  .vo-g3 > *:nth-child(-n + 2), .vo-g4 > *:nth-child(-n + 2) { border-top: none; }
  .vo-g3 > *:nth-child(2n), .vo-g4 > *:nth-child(2n) { border-left: 1px solid var(--line); }
  .vo-step, .vo-cat { padding: 28px 24px; }
}
@media (max-width: 560px) {
  .vo-g3 { grid-template-columns: 1fr; }
  .vo-g3 > * { border-left: none; border-top: 1px solid var(--line); }
  .vo-g3 > *:first-child { border-top: none; }
}
`,
        }}
      />
      <Navbar />

      <main>
        {/* ── Ouverture ─────────────────────────────────────────────── */}
        <header className="vo-wrap vo-top">
          <p className="vo-eyebrow" style={{ marginBottom: 20 }}>
            VENTE ENTRE PARTICULIERS
          </p>

          <h1 className="vo-h1">
            Vendez vos objets d&apos;occasion
            <br />
            <span>entre particuliers, gratuitement.</span>
          </h1>

          <p className="vo-lead">
            Un meuble qui ne sert plus, un téléphone remplacé, des vêtements devenus trop petits :
            ils valent quelque chose pour quelqu&apos;un d&apos;autre. Dépôt libre, aucune
            commission — le prix affiché est celui que vous encaissez.
          </p>

          <div style={{ display: "flex", gap: 14, marginBottom: 56, flexWrap: "wrap" }}>
            <Link href="/post" className="vo-cta">
              Déposer une annonce
              <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden>
                →
              </span>
            </Link>
            <Link href="/annonces" className="vo-ghost">
              Parcourir les annonces
            </Link>
          </div>

          <dl className="vo-card vo-g3" style={{ margin: 0 }}>
            {[
              { v: total > 0 ? total.toLocaleString("fr-FR") : "—", l: "objets en vente" },
              { v: "0 %", l: "de commission" },
              { v: "3 min", l: "pour publier" },
            ].map((s) => (
              <div key={s.l} className="vo-stat">
                <dt>{s.v}</dt>
                <dd>{s.l}</dd>
              </div>
            ))}
          </dl>
        </header>

        <div className="vo-wrap vo-mid">
          {/* ── Étapes ──────────────────────────────────────────────── */}
          <section>
            <p className="vo-eyebrow" style={{ marginBottom: 14 }}>
              COMMENT FAIRE
            </p>
            <h2 className="vo-h2">Déposez votre annonce en quelques minutes</h2>

            <ol className="vo-card vo-g3" style={{ margin: "0 0 96px", padding: 0, listStyle: "none" }}>
              {[
                {
                  n: "01",
                  t: "Photographiez l'objet",
                  d: "Quelques photos à la lumière du jour suffisent. C'est ce que l'acheteur regarde en premier, avant même le prix.",
                },
                {
                  n: "02",
                  t: "Décrivez et fixez le prix",
                  d: "Marque, état, dimensions. Le formulaire devine la catégorie à partir du titre et vous situe face aux prix du moment.",
                },
                {
                  n: "03",
                  t: "Publiez, puis répondez",
                  d: "L'annonce part en ligne immédiatement. Les acheteurs vous écrivent dans la messagerie du site.",
                },
              ].map((e) => (
                <li key={e.n} className="vo-step">
                  <b>{e.n}</b>
                  <strong>{e.t}</strong>
                  <span>{e.d}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* ── Catégories ──────────────────────────────────────────── */}
          <section>
            <p className="vo-eyebrow" style={{ marginBottom: 14 }}>
              CE QUI SE VEND
            </p>
            <h2 className="vo-h2 tight">Toutes les catégories d&apos;objets d&apos;occasion</h2>
            <p className="vo-sub">
              Chaque catégorie mène aux annonces en cours : de quoi situer votre objet et son prix
              avant de le mettre en vente.
            </p>

            <div className="vo-card vo-g4">
              {categories.map((c) => (
                <Link key={c.id} href={`/annonces/${c.id}`} className="vo-cat">
                  {/* Vignette de la maquette, avec l'icône de la catégorie
                      plutôt que son initiale : « M » désignerait aussi bien
                      Maison que Mode ou Multimédia. */}
                  <span
                    className="vo-tile"
                    style={{ background: CATEGORY_TINT[c.id] ?? "oklch(93% 0.02 230)" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                      {c.icon}
                    </span>
                  </span>
                  <b>{c.label}</b>
                  <span className={c.count > 0 ? undefined : "empty"}>
                    {c.count > 0 ? `${c.count.toLocaleString("fr-FR")} annonces` : "Soyez le premier"}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* ── Arguments, sur fond sombre ────────────────────────────
            Hors maquette : elle s'arrête aux catégories. Même échelle
            typographique, seul le fond change — c'est la seule respiration
            de contraste de la page. */}
        <section className="vo-dark">
          <div className="vo-wrap" style={{ paddingTop: 88, paddingBottom: 88 }}>
            <p className="vo-eyebrow" style={{ marginBottom: 14 }}>
              POURQUOI ICI
            </p>
            <h2 className="vo-h2">Ce que vous vendez vous revient, en entier.</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                columnGap: 48,
                rowGap: 32,
              }}
            >
              {[
                {
                  t: "Gratuit, sans commission",
                  d: "Le dépôt ne coûte rien et rien n'est prélevé à la vente. Sur un objet à 200 €, une commission de 10 % ailleurs vous coûterait 20 €. Ici, zéro.",
                },
                {
                  t: "Simple, même sans habitude",
                  d: "Le formulaire devine la catégorie à partir du titre et ne demande que ce qui sert vraiment à vendre.",
                },
                {
                  t: "Des échanges protégés",
                  d: "Messagerie intégrée, signalement en un clic, détection des annonces douteuses et des comptes qui reviennent après un bannissement.",
                },
                {
                  t: "Un public local",
                  d: "Vos annonces sortent d'abord auprès des visiteurs de votre secteur : remise en main propre, pas d'expédition à organiser.",
                },
              ].map((a) => (
                <div key={a.t} className="vo-arg">
                  <strong>{a.t}</strong>
                  <span>{a.d}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="vo-wrap" style={{ paddingTop: 88, paddingBottom: 88 }}>
          {/* ── Dernières annonces ────────────────────────────────────
              Intitulé factuel : la page est servie en cache partagé, elle ne
              connaît pas la position du visiteur. « Près de chez vous » serait
              une promesse non tenue. Les villes listées, elles, sont réelles. */}
          {listings.length > 0 && (
            <section style={{ marginBottom: 88 }}>
              <p className="vo-eyebrow" style={{ marginBottom: 14 }}>
                EN CE MOMENT
              </p>
              <h2 className="vo-h2">Les dernières annonces d&apos;objets déposées</h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {listings.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>

              {cities.length > 0 && (
                <div style={{ marginTop: 40, borderTop: "1px solid var(--line)", paddingTop: 28 }}>
                  <p className="vo-eyebrow" style={{ marginBottom: 16, color: "var(--muted)" }}>
                    LES VILLES LES PLUS ACTIVES
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {cities.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/ville/${c.slug}`}
                        className="vo-ghost"
                        style={{ padding: "8px 16px", fontSize: 14, fontWeight: 500 }}
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Conseils ──────────────────────────────────────────────── */}
          <section style={{ marginBottom: 88 }}>
            <p className="vo-eyebrow" style={{ marginBottom: 14 }}>
              LE MÉTIER
            </p>
            <h2 className="vo-h2 tight">Vendre ses objets d&apos;occasion : nos conseils</h2>
            <p className="vo-sub">
              La vente d&apos;occasion en ligne se joue sur quatre détails. Aucun ne demande de
              compétence particulière, seulement dix minutes de préparation.
            </p>

            <div>
              {CONSEILS.map((c, i) => (
                <article key={c.titre} className="vo-row" style={{ display: "flex", gap: 32 }}>
                  <span className="vo-num">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{c.titre}</h3>
                    <p>{c.texte}</p>
                  </div>
                </article>
              ))}
            </div>

            <p className="vo-sub" style={{ marginTop: 32, marginBottom: 0, maxWidth: 640 }}>
              Pour aller plus loin :{" "}
              <Link href="/blog/estimer-prix-objet-occasion" style={{ color: "var(--accent)", fontWeight: 600 }}>
                estimer le prix d&apos;un objet d&apos;occasion
              </Link>{" "}
              et{" "}
              <Link href="/blog/comment-vendre-objets-rapidement" style={{ color: "var(--accent)", fontWeight: 600 }}>
                vendre ses objets rapidement
              </Link>
              .
            </p>
          </section>

          {/* ── FAQ ───────────────────────────────────────────────────── */}
          <section style={{ marginBottom: 88 }}>
            <p className="vo-eyebrow" style={{ marginBottom: 14 }}>
              QUESTIONS
            </p>
            <h2 className="vo-h2">Questions fréquentes</h2>

            <div className="vo-faq">
              {FAQ.map((f) => (
                <details key={f.q} className="vo-row group">
                  <summary
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 24,
                      cursor: "pointer",
                      fontSize: 18,
                      fontWeight: 700,
                    }}
                  >
                    {f.q}
                    <span
                      className="material-symbols-outlined transition-transform duration-300 group-open:rotate-45"
                      style={{ fontSize: 22, color: "var(--muted)", flexShrink: 0 }}
                      aria-hidden
                    >
                      add
                    </span>
                  </summary>
                  <p style={{ marginTop: 16 }}>{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* ── Clôture ───────────────────────────────────────────────── */}
          <section className="vo-card" style={{ padding: "56px 32px", textAlign: "center" }}>
            <h2 className="vo-h2 tight" style={{ marginBottom: 12 }}>
              Votre objet vaut mieux qu&apos;un placard
            </h2>
            <p className="vo-sub" style={{ margin: "0 auto 32px" }}>
              Dépôt gratuit, aucune commission, annonce en ligne immédiatement.
            </p>
            <Link href="/post" className="vo-cta">
              Déposer une annonce
              <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden>
                →
              </span>
            </Link>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

/**
 * Contrôle du maillage vers les pages sous-catégorie.
 *
 *     npm run seo:sublinks
 *
 * ── Ce que ce script vérifie ──────────────────────────────────────────────
 *
 * `/annonces/{categorie}/{sous-categorie}` renvoie **404** quand la
 * sous-catégorie n'a aucune annonce publiée — décision volontaire, prise pour
 * sortir du rapport « exclue par la balise noindex » des milliers d'URL vides.
 *
 * La contrepartie, c'est qu'aucun lien interne ne doit y mener. Le crawl du
 * 23/08/2026 en a trouvé trois. Ce script rejoue le raisonnement des émetteurs
 * de liens sur les données réelles et signale toute sous-catégorie qui serait
 * liée alors que sa page n'existe pas.
 *
 * Il lit la base, il n'écrit rien.
 */
import { prisma } from "../lib/prisma";
import { CATEGORIES } from "../lib/categories";
import { subcategoryToSlug } from "../lib/seo-content";
import { evaluateListing } from "../lib/seo/indexability";

const BASE = process.env.SEO_BASE ?? "https://www.dealandcompany.fr";

async function main() {
  const rows = await prisma.listing.findMany({
    where: { status: "APPROVED", shadowBanned: false, deletedAt: null },
    select: {
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
    },
    take: 20_000,
  });

  /** Ce qui décide du 404 : le stock publié, quelle que soit sa qualité. */
  const published = new Map<string, number>();
  /** Ce qui décide du lien : le stock indexable, tel que le compte l'inventaire. */
  const indexable = new Map<string, number>();

  for (const row of rows) {
    const cat = CATEGORIES.find((c) => c.label === row.category);
    if (!cat || !row.subcategory) continue;
    const slug = subcategoryToSlug(row.subcategory);
    // Seules les sous-catégories du catalogue produisent une URL résoluble ;
    // le texte libre des imports (« Voitures d'occasion ») n'en fait pas partie.
    if (!cat.subcategories.some((s) => subcategoryToSlug(s) === slug)) continue;

    const key = `${cat.id}/${slug}`;
    published.set(key, (published.get(key) ?? 0) + 1);

    const verdict = evaluateListing({ ...row, isPro: !!row.user?.isPro } as never);
    if (verdict.indexable) indexable.set(key, (indexable.get(key) ?? 0) + 1);
  }

  let linked = 0;
  let hidden = 0;
  const broken: string[] = [];

  for (const cat of CATEGORIES) {
    const lines: string[] = [];
    for (const sub of cat.subcategories) {
      const slug = subcategoryToSlug(sub);
      const key = `${cat.id}/${slug}`;
      const pub = published.get(key) ?? 0;
      const idx = indexable.get(key) ?? 0;

      // Un lien est émis dès qu'il existe une annonce indexable ; la page
      // existe dès qu'il existe une annonce publiée. La seule combinaison
      // interdite est « lié mais inexistant ».
      const willLink = idx > 0;
      const pageExists = pub > 0;

      if (willLink && !pageExists) broken.push(`${BASE}/annonces/${key}`);
      if (willLink) linked++;
      else hidden++;

      lines.push(
        `    ${willLink ? "lié " : "caché"}  ${sub.padEnd(26)} publiées ${String(pub).padStart(3)} · indexables ${String(idx).padStart(3)}${
          !pageExists ? "  ← page en 404" : ""
        }`,
      );
    }
    console.log(`\n${cat.label} (/annonces/${cat.id})`);
    console.log(lines.join("\n"));
  }

  console.log(
    `\n${linked} sous-catégorie(s) liée(s), ${hidden} masquée(s) faute de stock indexable.`,
  );

  if (broken.length > 0) {
    console.error("\nLiens internes vers une page inexistante :");
    console.error(broken.map((u) => `  ${u}`).join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Aucun lien interne ne pointe vers une sous-catégorie en 404.");
  }
}

main().finally(() => prisma.$disconnect());

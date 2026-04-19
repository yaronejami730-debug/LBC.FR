import "./load-env";
import { CATEGORIES } from "../lib/categories";
import { FRENCH_CITIES, TOP_CITIES } from "../lib/cities";
import { getOrCreateSeoContent, pageKey, subcategoryToSlug, type SeoPageTarget } from "../lib/seo-content";
import { prisma } from "../lib/prisma";

const PRIORITY_CATEGORIES = ["vehicules", "immobilier", "multimedia", "mode", "maison"];
const LONG_TAIL_CITIES = TOP_CITIES.slice(0, 15);

const args = process.argv.slice(2);
const MODE = args[0] ?? "city";
const LIMIT = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0") || Infinity;
const CONCURRENCY = Number(args.find((a) => a.startsWith("--concurrency="))?.split("=")[1] ?? "4");
const ONLY_CATEGORY = args.find((a) => a.startsWith("--category="))?.split("=")[1];

function buildTargets(): SeoPageTarget[] {
  const targets: SeoPageTarget[] = [];

  if (MODE === "city" || MODE === "all") {
    for (const cat of CATEGORIES) {
      if (ONLY_CATEGORY && cat.id !== ONLY_CATEGORY) continue;
      const cities = MODE === "all" ? FRENCH_CITIES : TOP_CITIES;
      for (const city of cities) {
        targets.push({ categoryId: cat.id, citySlug: city.slug });
      }
    }
  }

  if (MODE === "sub" || MODE === "all") {
    for (const cat of CATEGORIES) {
      if (!PRIORITY_CATEGORIES.includes(cat.id)) continue;
      if (ONLY_CATEGORY && cat.id !== ONLY_CATEGORY) continue;
      for (const sub of cat.subcategories) {
        for (const city of LONG_TAIL_CITIES) {
          targets.push({
            categoryId: cat.id,
            subcategorySlug: subcategoryToSlug(sub),
            citySlug: city.slug,
          });
        }
      }
    }
  }

  return targets;
}

async function main() {
  const all = buildTargets();
  const existing = new Set(
    (await prisma.seoPageContent.findMany({ select: { pageKey: true } })).map((r) => r.pageKey)
  );
  const missing = all.filter((t) => !existing.has(pageKey(t)));
  const todo = missing.slice(0, LIMIT === Infinity ? missing.length : LIMIT);

  console.log(
    `[seo-batch] mode=${MODE} cible=${all.length} déjà=${existing.size} à_générer=${missing.length} à_traiter=${todo.length} concurrence=${CONCURRENCY}`
  );

  let ok = 0;
  let ko = 0;
  let done = 0;
  const start = Date.now();

  const queue = [...todo];
  async function worker(id: number) {
    while (queue.length > 0) {
      const target = queue.shift();
      if (!target) return;
      const key = pageKey(target);
      try {
        const result = await getOrCreateSeoContent(target);
        if (result) {
          ok++;
        } else {
          ko++;
        }
      } catch (err) {
        ko++;
        console.error(`[seo-batch w${id}] échec ${key}`, err);
      }
      done++;
      if (done % 10 === 0 || done === todo.length) {
        const elapsed = (Date.now() - start) / 1000;
        const rate = done / elapsed;
        const eta = (todo.length - done) / rate;
        console.log(
          `[seo-batch] ${done}/${todo.length} (ok=${ok} ko=${ko}) ${rate.toFixed(2)}/s ETA ${eta.toFixed(0)}s`
        );
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)));

  console.log(`[seo-batch] terminé en ${((Date.now() - start) / 1000).toFixed(1)}s ok=${ok} ko=${ko}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

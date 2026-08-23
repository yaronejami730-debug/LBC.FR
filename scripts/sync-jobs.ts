/**
 * Importe les offres d'emploi du flux RapidAPI « Job Postings RSS Feed » vers
 * Deal & Co.
 *
 * Pipeline :
 *   1. GET `jobs_full` page par page, avec la clé `RAPIDAPI_KEY`.
 *   2. Chaque offre passe par `mapJob()` — l'unique endroit qui connaît la
 *      forme du flux.
 *   3. POST sur `/api/external/listings`, idempotent par `externalId`.
 *
 * Usage :
 *   npx tsx scripts/sync-jobs.ts --probe                    # schéma du flux
 *   npx tsx scripts/sync-jobs.ts --key=dco_xxx              # simulation
 *   npx tsx scripts/sync-jobs.ts --key=dco_xxx --commit     # écriture réelle
 *
 * Options : --country=fr  --pages=3  --limit=20  --salary-only
 *
 * ── Deux partis pris qui méritent d'être écrits ───────────────────────────
 *
 * **Simulation par défaut.** Un import écrit dans la base de production et
 * déclenche la modération. Rien ne s'écrit sans `--commit` : on lit d'abord ce
 * qu'on s'apprête à créer.
 *
 * **`mapJob()` est le seul point de contact avec le format du flux.** Le reste
 * du fichier ne sait pas ce qu'est une offre d'emploi. Le jour où le
 * fournisseur renomme un champ, il y a un endroit à corriger, et `--probe` dit
 * lequel.
 */
import "./load-env";

const API_HOST = "job-postings-rss-feed.p.rapidapi.com";
const API_URL = `https://${API_HOST}/api/rss/v1/jobs_full`;

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const has = (name: string) => args.includes(`--${name}`);

const COUNTRY = flag("country") ?? "fr";
const PAGES = Number(flag("pages") ?? 1);
const LIMIT = flag("limit") ? Number(flag("limit")) : Infinity;
const COMMIT = has("commit");
const PROBE = has("probe");
const SALARY_ONLY = has("salary-only");

/** Catégorie cible — existe déjà dans `lib/categories.ts`. */
const CATEGORY = "emploi";
const SUBCATEGORY = "Offres d'emploi";

// ─────────────────────────────────────────────────────────────
// RÉCUPÉRATION
// ─────────────────────────────────────────────────────────────

type Json = Record<string, unknown>;

async function fetchPage(page: number): Promise<Json[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY absent de .env.local");

  const url = new URL(API_URL);
  url.searchParams.set("page", String(page));
  url.searchParams.set("countryCode", COUNTRY);
  if (SALARY_ONLY) url.searchParams.set("hasSalary", "true");

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-host": API_HOST,
      "x-rapidapi-key": key,
    },
  });

  const text = await res.text();
  if (!res.ok) {
    // 401 = clé invalide ; 403 = app non abonnée à cette API ; 429 = quota.
    // Les trois se corrigent sur rapidapi.com, pas dans ce fichier.
    throw new Error(`HTTP ${res.status} — ${text.slice(0, 200)}`);
  }

  const body = JSON.parse(text) as unknown;
  return extractItems(body);
}

/**
 * Le flux peut renvoyer un tableau nu ou l'enrober (`jobs`, `data`, `items`,
 * `results`). On accepte les formes plausibles plutôt que d'en imposer une :
 * l'enveloppe n'a aucune importance, seul le tableau compte.
 */
function extractItems(body: unknown): Json[] {
  if (Array.isArray(body)) return body as Json[];
  if (body && typeof body === "object") {
    for (const k of ["jobs", "data", "items", "results", "postings", "channel"]) {
      const v = (body as Json)[k];
      if (Array.isArray(v)) return v as Json[];
      if (v && typeof v === "object") {
        const nested = extractItems(v);
        if (nested.length) return nested;
      }
    }
  }
  return [];
}

// ─────────────────────────────────────────────────────────────
// ADAPTATION — le seul endroit qui connaît le format du flux
// ─────────────────────────────────────────────────────────────

/** Première valeur non vide parmi plusieurs noms de champs possibles. */
function pick(row: Json, ...names: string[]): string | null {
  for (const n of names) {
    const v = row[n];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

function pickNumber(row: Json, ...names: string[]): number | null {
  for (const n of names) {
    const v = row[n];
    if (typeof v === "number" && isFinite(v)) return v;
    if (typeof v === "string") {
      const parsed = Number(v.replace(/[^\d.]/g, ""));
      if (v.trim() && isFinite(parsed) && parsed > 0) return parsed;
    }
  }
  return null;
}

/** Supprime le balisage HTML des descriptions RSS, qui en contiennent presque toujours. */
function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type MappedJob = {
  externalId: string;
  sourceUrl: string | null;
  title: string;
  description: string;
  price: number;
  category: string;
  subcategory: string;
  location: string;
  images: string[];
  metadata: Record<string, unknown>;
};

/**
 * Traduit une offre du flux en payload d'ingestion.
 *
 * `price` porte le **salaire**, pas un prix de vente. C'est le champ que le
 * contrat d'ingestion impose et que l'affichage utilise ; le salaire est la
 * seule grandeur monétaire d'une offre d'emploi, donc elle y va. Quand le flux
 * donne une fourchette, on retient le bas : annoncer le haut serait vendre
 * l'offre au-dessus de ce qu'elle est. Absence de salaire → 0, valeur acceptée
 * par le validateur et rendue « Prix à débattre » à l'écran.
 */
function mapJob(row: Json): { ok: true; job: MappedJob } | { ok: false; reason: string } {
  const id = pick(row, "id", "jobId", "guid", "job_id", "uuid", "slug");
  const title = pick(row, "title", "jobTitle", "job_title", "name", "position");
  const rawDescription = pick(row, "description", "jobDescription", "job_description", "summary", "content", "snippet");
  const url = pick(row, "url", "link", "jobUrl", "job_url", "applyUrl", "apply_url");

  if (!title) return { ok: false, reason: "titre absent" };
  if (!rawDescription) return { ok: false, reason: "description absente" };

  const description = stripHtml(rawDescription);
  if (description.length < 10) return { ok: false, reason: "description trop courte (<10)" };

  const company = pick(row, "company", "companyName", "company_name", "employer", "organization");
  const city = pick(row, "city", "locationCity", "location_city");
  const region = pick(row, "region", "state", "locationState", "location_state");
  const country = pick(row, "country", "countryCode", "country_code");
  const locationRaw = pick(row, "location", "jobLocation", "job_location", "place");

  const location =
    locationRaw ??
    [city, region, country].filter(Boolean).join(", ") ??
    "";
  if (!location || location.length < 2) return { ok: false, reason: "localisation absente" };

  // Fourchette basse du salaire. Un salaire annuel et un taux horaire ne se
  // mélangent pas : `salaryPeriod` est conservé en métadonnée pour que
  // l'affichage puisse trancher plus tard sans réinterroger la source.
  const salaryMin = pickNumber(row, "salaryMin", "salary_min", "minSalary", "min_salary", "salary");

  // L'identité stable de l'offre. À défaut d'ID fourni, l'URL fait foi : elle
  // est unique chez le fournisseur et ne bouge pas d'une exécution à l'autre.
  // Sans l'un ni l'autre, aucune idempotence possible — on refuse l'offre
  // plutôt que de créer un doublon à chaque passage.
  const identity = id ?? url;
  if (!identity) return { ok: false, reason: "ni id ni url — idempotence impossible" };

  const titleWithCompany = company && !title.includes(company) ? `${title} — ${company}` : title;

  return {
    ok: true,
    job: {
      externalId: `jobsrss:${identity}`,
      sourceUrl: url,
      title: titleWithCompany.slice(0, 200),
      description: description.slice(0, 10_000),
      price: salaryMin ?? 0,
      category: CATEGORY,
      subcategory: SUBCATEGORY,
      location,
      // Les flux d'offres ne transportent pas de photo exploitable (logos en
      // hotlink, souvent protégés). Aucune image plutôt qu'une image empruntée.
      images: [],
      metadata: {
        importedVia: "external_api",
        externalId: `jobsrss:${identity}`,
        sourceUrl: url,
        importedAt: new Date().toISOString(),
        job: {
          company,
          city,
          region,
          country,
          salaryMin,
          salaryMax: pickNumber(row, "salaryMax", "salary_max", "maxSalary", "max_salary"),
          salaryCurrency: pick(row, "salaryCurrency", "salary_currency", "currency"),
          salaryPeriod: pick(row, "salaryPeriod", "salary_period", "period"),
          employmentType: pick(row, "employmentType", "employment_type", "jobType", "job_type", "contractType"),
          remote: row.remote ?? row.isRemote ?? row.is_remote ?? null,
          publishedAt: pick(row, "publishedAt", "published_at", "datePosted", "date_posted", "pubDate"),
        },
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────
// ENVOI
// ─────────────────────────────────────────────────────────────

async function push(job: MappedJob, target: string, apiKey: string) {
  const res = await fetch(`${target}/api/external/listings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(job),
  });
  const body = (await res.json().catch(() => ({}))) as Json;
  return { status: res.status, body };
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────

async function main() {
  const apiKey = flag("key") ?? process.env.DCO_API_KEY ?? "";
  const target = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");

  if (!PROBE && !apiKey) {
    console.error("Clé API Deal & Co requise : --key=dco_... (ou DCO_API_KEY).");
    console.error("Créer une clé : npx tsx scripts/create-api-key.ts");
    process.exit(1);
  }

  console.log(`Source  : ${API_URL} (countryCode=${COUNTRY}, pages=${PAGES})`);
  if (!PROBE) console.log(`Cible   : ${target}/api/external/listings`);
  console.log(COMMIT ? "Mode    : ÉCRITURE\n" : "Mode    : simulation (ajouter --commit pour écrire)\n");

  const rows: Json[] = [];
  for (let page = 1; page <= PAGES; page++) {
    const items = await fetchPage(page);
    console.log(`  page ${page} → ${items.length} offres`);
    if (!items.length) break;
    rows.push(...items);
  }

  if (!rows.length) {
    console.log("\nAucune offre renvoyée par le flux.");
    return;
  }

  // ── Mode sonde : afficher la forme réelle, ne rien importer ───────────────
  //
  // Écrit avant d'avoir eu accès au flux : les noms de champs de `mapJob()`
  // sont des candidats plausibles, pas des faits. Cette sonde les confirme ou
  // les corrige en une exécution.
  if (PROBE) {
    const keys = new Map<string, number>();
    for (const row of rows) {
      for (const k of Object.keys(row)) keys.set(k, (keys.get(k) ?? 0) + 1);
    }
    console.log(`\n── Champs présents (sur ${rows.length} offres) ──`);
    for (const [k, n] of [...keys].sort((a, b) => b[1] - a[1])) {
      const sample = rows.find((r) => r[k] != null)?.[k];
      const preview = JSON.stringify(sample)?.slice(0, 90) ?? "";
      console.log(`  ${k.padEnd(24)} ${String(n).padStart(4)}×  ${preview}`);
    }
    console.log("\n── Première offre complète ──");
    console.log(JSON.stringify(rows[0], null, 2).slice(0, 3000));
    return;
  }

  let created = 0;
  let deduped = 0;
  let skipped = 0;
  let failed = 0;
  const skipReasons = new Map<string, number>();

  for (const row of rows.slice(0, LIMIT)) {
    const mapped = mapJob(row);
    if (!mapped.ok) {
      skipped++;
      skipReasons.set(mapped.reason, (skipReasons.get(mapped.reason) ?? 0) + 1);
      continue;
    }
    const job = mapped.job;

    if (!COMMIT) {
      console.log(`  [simu] ${job.externalId}`);
      console.log(`         ${job.title}`);
      console.log(`         ${job.location} · ${job.price || "salaire non communiqué"} · ${job.description.length} car.`);
      created++;
      continue;
    }

    process.stdout.write(`  ${job.externalId} … `);
    try {
      const { status, body } = await push(job, target, apiKey);
      if (status === 201) {
        console.log(`✓ créée (${body.status}, risque ${body.riskScore})`);
        created++;
      } else if (status === 200 && body.deduplicated) {
        console.log("= déjà présente");
        deduped++;
      } else {
        console.log(`✗ HTTP ${status} — ${body.error ?? ""}`);
        failed++;
      }
    } catch (err) {
      console.log(`✗ ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(
    `\n${COMMIT ? "Créées" : "À créer"} : ${created}   Déjà présentes : ${deduped}   Ignorées : ${skipped}   Échecs : ${failed}`,
  );
  for (const [reason, n] of [...skipReasons].sort((a, b) => b[1] - a[1])) {
    console.log(`   ignorées — ${reason} : ${n}`);
  }

  if (created > 0) {
    console.log(
      "\nRappel SEO : ces annonces portent `importedVia: external_api`, donc\n" +
        "`noindex` par `lib/seo/indexability.ts`. Visibles aux visiteurs, hors index Google.",
    );
  }
}

main().catch((err) => {
  console.error(`\n✗ ${(err as Error).message}`);
  process.exit(1);
});

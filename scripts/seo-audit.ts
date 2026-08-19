/**
 * Audit d'indexabilité — contrôle HTTP réel, sans accès base ni Search Console.
 *
 *   npm run seo:audit                          — production
 *   npm run seo:audit -- --base=http://localhost:3000
 *   npm run seo:audit -- --only=ERROR
 *
 * ── Pourquoi ce script ────────────────────────────────────────────────────
 *
 * Les trois défauts trouvés le 19/08/2026 étaient tous invisibles à la lecture
 * du code, et tous les trois se voyaient en une requête HTTP :
 *
 *   — `cache-control: private, no-store` sur les pages publiques, posé par
 *     NextAuth via le middleware, qui écrasait les en-têtes de cache déclarés
 *     dans `next.config.ts` ;
 *   — `/annonce/{id}` répondant 200 au lieu de 308, parce qu'un `loading.tsx`
 *     ouvrait une frontière Suspense avant la redirection ;
 *   — `/admin/login` en `index, follow`, hérité du layout racine.
 *
 * D'où la règle de ce fichier : **il ne lit aucune source, il interroge le
 * site.** Ce que Googlebot reçoit est la seule vérité qui compte, et elle ne se
 * déduit pas d'un `generateMetadata`.
 *
 * ── Les trois verdicts ────────────────────────────────────────────────────
 *
 *   ERROR   — contradiction qui coûte des pages : une URL du sitemap qui ne
 *             répond pas 200, une page publique en `noindex`, une page privée
 *             indexable, un `X-Robots-Tag: noindex` sur du contenu public.
 *   WARNING — cohérent mais perfectible : page indexable absente du sitemap,
 *             page SEO non cachable, chaîne de redirection à plus d'un saut.
 *   PASS    — conforme.
 *
 * Le script sort en code 1 s'il reste une ERROR : utilisable en CI.
 */

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

const BASE = (flag("base") ?? "https://www.dealandcompany.fr").replace(/\/$/, "");
const ONLY = flag("only")?.toUpperCase() as Verdict | undefined;

/** Un crawler s'annonce. Un script déguisé fausse ses propres mesures. */
const UA = "DealAndCoSeoAudit/1.0 (+https://www.dealandcompany.fr)";

type Verdict = "PASS" | "WARNING" | "ERROR";
type Finding = { verdict: Verdict; url: string; check: string; detail: string };

const findings: Finding[] = [];
const add = (verdict: Verdict, url: string, check: string, detail: string) =>
  findings.push({ verdict, url, check, detail });

type Probe = {
  status: number;
  location: string | null;
  xRobots: string | null;
  cacheControl: string | null;
  metaRobots: string | null;
  canonical: string | null;
  title: string | null;
};

async function probe(path: string): Promise<Probe | null> {
  const url = path.startsWith("http") ? path : BASE + path;
  try {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(30_000),
    });
    const ct = res.headers.get("content-type") ?? "";
    const html = ct.includes("text/html") ? await res.text() : "";
    return {
      status: res.status,
      location: res.headers.get("location"),
      xRobots: res.headers.get("x-robots-tag"),
      cacheControl: res.headers.get("cache-control"),
      metaRobots: html.match(/<meta name="robots" content="([^"]*)"/i)?.[1] ?? null,
      canonical: html.match(/<link rel="canonical" href="([^"]*)"/i)?.[1] ?? null,
      title: html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? null,
    };
  } catch (err) {
    add("ERROR", url, "réseau", (err as Error).message);
    return null;
  }
}

/** Règles `Disallow` du bloc `User-agent: *`, telles que servies. */
async function fetchDisallow(): Promise<string[]> {
  const res = await fetch(`${BASE}/robots.txt`, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    add("ERROR", "/robots.txt", "accessibilité", `robots.txt répond ${res.status}`);
    return [];
  }
  const text = await res.text();
  add("PASS", "/robots.txt", "accessibilité", `${res.status}, ${text.length} octets`);
  if (!/^Sitemap:/im.test(text)) {
    add("ERROR", "/robots.txt", "sitemap déclaré", "aucune ligne `Sitemap:`");
  }
  const rules: string[] = [];
  let inStar = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (/^User-agent:/i.test(line)) inStar = line.split(":")[1].trim() === "*";
    else if (inStar && /^Disallow:/i.test(line)) {
      const v = line.split(":").slice(1).join(":").trim();
      if (v) rules.push(v);
    }
  }
  return rules;
}

/** Correspondance préfixe + joker `*`, comme l'applique Googlebot. */
function blockedBy(path: string, rules: string[]): string | null {
  for (const rule of rules) {
    const re = new RegExp("^" + rule.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*"));
    if (re.test(path)) return rule;
  }
  return null;
}

const isNoindex = (p: Probe) =>
  /noindex/i.test(p.metaRobots ?? "") || /noindex/i.test(p.xRobots ?? "");

/**
 * Routes publiques attendues indexables.
 *
 * Volontairement écrites à la main plutôt que dérivées du sitemap : un sitemap
 * qui oublie une page ne peut pas signaler son propre oubli.
 */
const PUBLIC_SEO = [
  "/",
  "/annonces",
  "/nouveautes",
  "/blog",
  "/comparatif",
  "/voiture-budget",
  "/a-propos",
  "/contact",
  "/api-doc",
  "/mentions-legales",
  "/cgu",
  "/confidentialite",
  "/vente-objets-occasion-particuliers",
  "/early-adopter",
];

/**
 * Routes qui ne doivent jamais être indexables.
 *
 * Trois issues acceptables : `noindex`, une redirection vers la connexion, ou
 * un 404. Une 200 indexable est une ERROR — y compris si `robots.txt` bloque
 * l'URL, car un blocage n'empêche pas l'indexation sur liens externes.
 */
const PRIVATE = [
  "/admin",
  "/admin/login",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verifier-email",
  "/accepter-cgu",
  "/activer-compte",
  "/post",
  "/profile",
  "/messages",
  "/favoris",
  "/brouillons",
  "/mes-annonces",
  "/mes-reservations",
  "/mon-agenda",
  "/recherches",
  "/search",
  "/support",
  "/preferences/email",
  "/annonceur",
  "/annonceur/connexion",
  "/equipe/connexion",
];

async function auditPublic(rules: string[], sitemap: Set<string>) {
  for (const path of PUBLIC_SEO) {
    const p = await probe(path);
    if (!p) continue;

    if (p.status !== 200) {
      add("ERROR", path, "statut", `${p.status}${p.location ? ` → ${p.location}` : ""} — attendu 200`);
      continue;
    }
    const rule = blockedBy(path, rules);
    if (rule) add("ERROR", path, "robots.txt", `page publique bloquée par \`Disallow: ${rule}\``);
    if (isNoindex(p)) add("ERROR", path, "noindex", `page publique en noindex (${p.metaRobots ?? p.xRobots})`);
    if (p.xRobots && /noindex/i.test(p.xRobots)) add("ERROR", path, "X-Robots-Tag", p.xRobots);

    const expected = path === "/" ? BASE : BASE + path;
    if (!p.canonical) add("WARNING", path, "canonical", "absente");
    else if (p.canonical.replace(/\/$/, "") !== expected.replace(/\/$/, ""))
      add("WARNING", path, "canonical", `pointe vers ${p.canonical}`);

    if (!sitemap.has(expected.replace(/\/$/, "")) && !sitemap.has(expected))
      add("WARNING", path, "sitemap", "indexable mais absente du sitemap");

    if (/no-store|private/i.test(p.cacheControl ?? ""))
      add("WARNING", path, "cache", `non cachable par le CDN — ${p.cacheControl}`);

    if (!p.title) add("WARNING", path, "title", "absent");

    if (!findings.some((f) => f.url === path && f.verdict !== "PASS"))
      add("PASS", path, "page publique", `200, ${p.metaRobots ?? "index hérité"}`);
  }
}

async function auditPrivate(rules: string[], sitemap: Set<string>) {
  for (const path of PRIVATE) {
    const p = await probe(path);
    if (!p) continue;

    if (sitemap.has(BASE + path)) add("ERROR", path, "sitemap", "page privée présente dans le sitemap");

    const redirected = p.status >= 300 && p.status < 400;
    const gone = p.status === 404 || p.status === 410;

    if (redirected || gone || isNoindex(p)) {
      add("PASS", path, "page privée", redirected ? `${p.status} → ${p.location}` : gone ? `${p.status}` : `noindex`);
      continue;
    }
    const rule = blockedBy(path, rules);
    add(
      "ERROR",
      path,
      "indexabilité",
      `200 sans noindex${rule ? ` (bloquée par \`Disallow: ${rule}\`, ce qui n'empêche pas l'indexation sur liens externes)` : ""}`,
    );
  }
}

async function auditSitemap(rules: string[]): Promise<Set<string>> {
  const res = await fetch(`${BASE}/sitemap.xml`, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    add("ERROR", "/sitemap.xml", "accessibilité", `répond ${res.status}`);
    return new Set();
  }
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  add("PASS", "/sitemap.xml", "accessibilité", `${res.status}, ${urls.length} URL`);

  for (const url of urls) {
    const path = url.replace(BASE, "") || "/";
    const rule = blockedBy(path, rules);
    if (rule) add("ERROR", url, "sitemap × robots.txt", `annoncée puis bloquée par \`Disallow: ${rule}\``);

    const p = await probe(url);
    if (!p) continue;
    if (p.status !== 200)
      add("ERROR", url, "sitemap × statut", `${p.status}${p.location ? ` → ${p.location}` : ""}`);
    else if (isNoindex(p)) add("ERROR", url, "sitemap × noindex", p.metaRobots ?? p.xRobots ?? "");
    else if (p.canonical && p.canonical.replace(/\/$/, "") !== url.replace(/\/$/, ""))
      add("WARNING", url, "sitemap × canonical", `canonical → ${p.canonical}`);
  }
  return new Set(urls.map((u) => u.replace(/\/$/, "")));
}

/** Une seule redirection avant la destination finale. */
async function auditDomain() {
  const starts = [
    BASE.replace("https://www.", "http://"),
    BASE.replace("https://www.", "https://"),
    BASE.replace("https://", "http://"),
  ];
  for (const start of [...new Set(starts)]) {
    let url = start;
    const chain: string[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await fetch(url, { redirect: "manual", headers: { "User-Agent": UA } }).catch(() => null);
      if (!res) break;
      if (res.status < 300 || res.status >= 400) break;
      const next = res.headers.get("location");
      if (!next) break;
      chain.push(`${res.status} → ${next}`);
      url = next.startsWith("http") ? next : BASE + next;
    }
    if (chain.length === 0) add("PASS", start, "domaine", "destination directe");
    else if (chain.length === 1) add("PASS", start, "domaine", chain[0]);
    else add("WARNING", start, "domaine", `${chain.length} sauts : ${chain.join(" | ")}`);
  }
}

async function main() {
  console.log(`Audit de ${BASE}\n`);
  const rules = await fetchDisallow();
  console.log(`robots.txt : ${rules.length} règles Disallow pour \`User-agent: *\`\n`);

  const sitemap = await auditSitemap(rules);
  await auditPublic(rules, sitemap);
  await auditPrivate(rules, sitemap);
  await auditDomain();

  const order: Verdict[] = ["ERROR", "WARNING", "PASS"];
  const shown = ONLY ? findings.filter((f) => f.verdict === ONLY) : findings;

  for (const verdict of order) {
    const rows = shown.filter((f) => f.verdict === verdict);
    if (!rows.length) continue;
    console.log(`\n=== ${verdict} (${rows.length}) ===`);
    for (const f of rows) console.log(`  ${f.url}\n      ${f.check} : ${f.detail}`);
  }

  const errors = findings.filter((f) => f.verdict === "ERROR").length;
  const warnings = findings.filter((f) => f.verdict === "WARNING").length;
  console.log(
    `\nRésultat : ${errors} ERROR · ${warnings} WARNING · ${findings.length - errors - warnings} PASS`,
  );
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

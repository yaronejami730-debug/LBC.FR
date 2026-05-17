/**
 * Tâches de modération planifiables — logique partagée entre les scripts CLI
 * (`scripts/*.ts`) et les routes cron Vercel (`app/api/cron/*`).
 *
 * Chaque fonction reçoit le client Prisma en paramètre (pas d'import direct),
 * ne fait aucun `process.exit` et ne logge rien : elle renvoie un résultat
 * structuré que l'appelant journalise comme il veut.
 */

import type { PrismaClient } from "@prisma/client";

// ════════════════════════════════════════════════════════════════════════════
// Import de blacklist
// ════════════════════════════════════════════════════════════════════════════

/** Flux publics de domaines de phishing/scam (listes JSON de chaînes). */
const BLACKLIST_SOURCES: { name: string; url: string }[] = [
  {
    name: "discord-antiscam",
    url: "https://raw.githubusercontent.com/Discord-AntiScam/scam-links/main/list.json",
  },
];

/** Extrait un hostname propre d'une entrée brute (domaine ou URL). */
function cleanDomain(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  s = s.split("/")[0].split("?")[0].split("#")[0];
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) return null;
  return s;
}

export type BlacklistImportResult = {
  sources: { name: string; fetched: number; imported: number; ok: boolean }[];
  totalDomains: number;
};

/** Importe les flux externes de domaines frauduleux dans la table `Blacklist`. */
export async function runBlacklistImport(prisma: PrismaClient): Promise<BlacklistImportResult> {
  const BATCH = 1000;
  const sources: BlacklistImportResult["sources"] = [];

  for (const src of BLACKLIST_SOURCES) {
    let entries: unknown;
    try {
      const res = await fetch(src.url);
      if (!res.ok) {
        sources.push({ name: src.name, fetched: 0, imported: 0, ok: false });
        continue;
      }
      entries = await res.json();
    } catch {
      sources.push({ name: src.name, fetched: 0, imported: 0, ok: false });
      continue;
    }

    if (!Array.isArray(entries)) {
      sources.push({ name: src.name, fetched: 0, imported: 0, ok: false });
      continue;
    }

    const domains = [
      ...new Set(
        entries
          .filter((e): e is string => typeof e === "string")
          .map(cleanDomain)
          .filter((d): d is string => d !== null),
      ),
    ];

    let imported = 0;
    for (let i = 0; i < domains.length; i += BATCH) {
      const chunk = domains.slice(i, i + BATCH);
      const result = await prisma.blacklist.createMany({
        data: chunk.map((value) => ({ kind: "domain", value, source: src.name })),
        skipDuplicates: true,
      });
      imported += result.count;
    }
    sources.push({ name: src.name, fetched: domains.length, imported, ok: true });
  }

  const totalDomains = await prisma.blacklist.count({ where: { kind: "domain" } });
  return { sources, totalDomains };
}

// ════════════════════════════════════════════════════════════════════════════
// Détection de fraude organisée
// ════════════════════════════════════════════════════════════════════════════

/** Union-Find — regroupe les comptes en composantes connexes. */
class UnionFind {
  private parent = new Map<string, string>();

  find(x: string): string {
    const p = this.parent.get(x);
    if (p === undefined) {
      this.parent.set(x, x);
      return x;
    }
    if (p === x) return x;
    const root = this.find(p);
    this.parent.set(x, root);
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }

  members(): string[] {
    return [...this.parent.keys()];
  }
}

type IdentifierKind = "phone" | "ip" | "simhash" | "image";

export type FraudCluster = {
  root: string;
  members: string[];
  links: IdentifierKind[];
  hasSanctioned: boolean;
};

export type FraudScanResult = {
  analysed: number;
  clusters: FraudCluster[]; // clusters confirmés uniquement
  restricted: number;
};

/**
 * Détecte les clusters de comptes liés par identifiants partagés.
 * `apply=true` restreint les comptes des clusters confirmés.
 */
export async function runFraudRingScan(
  prisma: PrismaClient,
  apply: boolean,
): Promise<FraudScanResult> {
  const WINDOW_DAYS = 180;
  const MIN_CLUSTER = 3;
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);

  const listings = await prisma.listing.findMany({
    where: { deletedAt: null, createdAt: { gte: since } },
    select: { userId: true, phoneHash: true, ipAtCreate: true, simhash: true, images: true },
  });

  const groups: Record<IdentifierKind, Map<string, Set<string>>> = {
    phone: new Map(),
    ip: new Map(),
    simhash: new Map(),
    image: new Map(),
  };
  const addId = (kind: IdentifierKind, value: string | null | undefined, userId: string) => {
    if (!value) return;
    const set = groups[kind].get(value) ?? new Set<string>();
    set.add(userId);
    groups[kind].set(value, set);
  };

  for (const l of listings) {
    addId("phone", l.phoneHash, l.userId);
    addId("ip", l.ipAtCreate, l.userId);
    addId("simhash", l.simhash, l.userId);
    try {
      for (const url of (JSON.parse(l.images) as string[]).slice(0, 5)) {
        if (typeof url === "string" && url.startsWith("http")) addId("image", url, l.userId);
      }
    } catch {
      /* images JSON malformé — ignoré */
    }
  }

  const uf = new UnionFind();
  const evidence = new Map<string, Set<IdentifierKind>>();
  for (const kind of Object.keys(groups) as IdentifierKind[]) {
    for (const users of groups[kind].values()) {
      if (users.size < 2) continue;
      const [first, ...rest] = users;
      for (const u of rest) uf.union(first, u);
      const root = uf.find(first);
      const ev = evidence.get(root) ?? new Set<IdentifierKind>();
      ev.add(kind);
      evidence.set(root, ev);
    }
  }

  const rawClusters = new Map<string, string[]>();
  for (const user of uf.members()) {
    const root = uf.find(user);
    const arr = rawClusters.get(root) ?? [];
    arr.push(user);
    rawClusters.set(root, arr);
  }

  const allUsers = [...rawClusters.values()].flat();
  const states = await prisma.user.findMany({
    where: { id: { in: allUsers } },
    select: { id: true, bannedAt: true, restrictedAt: true },
  });
  const stateById = new Map(states.map((s) => [s.id, s]));

  const clusters: FraudCluster[] = [];
  let restricted = 0;

  for (const [root, members] of rawClusters) {
    if (members.length < 2) continue;
    const links = [...(evidence.get(root) ?? [])];
    const hasSanctioned = members.some((u) => {
      const s = stateById.get(u);
      return Boolean(s?.bannedAt || s?.restrictedAt);
    });
    const confirmed = hasSanctioned || (members.length >= MIN_CLUSTER && links.length >= 2);
    if (!confirmed) continue;

    clusters.push({ root, members, links, hasSanctioned });

    if (apply) {
      const toRestrict = members.filter((u) => {
        const s = stateById.get(u);
        return s && !s.bannedAt && !s.restrictedAt;
      });
      if (toRestrict.length > 0) {
        await prisma.user.updateMany({
          where: { id: { in: toRestrict } },
          data: {
            restrictedAt: new Date(),
            adminNote: `[FRAUD_RING] cluster ${root.slice(0, 8)} (${members.length} comptes, liens: ${links.join("/")})`,
          } as any,
        });
        restricted += toRestrict.length;
      }
    }
  }

  return { analysed: listings.length, clusters, restricted };
}

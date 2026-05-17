/**
 * Détection de fraude organisée — clustering de comptes par identifiants partagés.
 *
 * La fraude organisée n'est pas détectable compte par compte : il faut un
 * graphe. Deux comptes sont reliés s'ils partagent un identifiant fort —
 * numéro de téléphone, IP de création, empreinte d'annonce (SimHash), image.
 * Les composantes connexes du graphe = clusters de comptes liés.
 *
 * Un cluster est « confirmé » s'il contient déjà un compte banni/restreint,
 * ou s'il est large et relié par plusieurs types d'identifiants.
 *
 * Exécution :
 *   npx tsx scripts/fraud-ring-scan.ts            → rapport seul (lecture)
 *   npx tsx scripts/fraud-ring-scan.ts --apply    → restreint les clusters confirmés
 */
import "./load-env";
import { prisma } from "../lib/prisma";

const APPLY = process.argv.includes("--apply");
const WINDOW_DAYS = 180;     // fenêtre d'analyse
const MIN_CLUSTER = 3;       // taille à partir de laquelle un cluster est suspect

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

async function main() {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);

  const listings = await prisma.listing.findMany({
    where: { deletedAt: null, createdAt: { gte: since } },
    select: {
      userId: true,
      phoneHash: true,
      ipAtCreate: true,
      simhash: true,
      images: true,
    },
  });
  console.log(`Analyse de ${listings.length} annonces sur ${WINDOW_DAYS} jours…`);

  // value → comptes qui la partagent, par type d'identifiant.
  const groups: Record<IdentifierKind, Map<string, Set<string>>> = {
    phone: new Map(),
    ip: new Map(),
    simhash: new Map(),
    image: new Map(),
  };
  const addId = (kind: IdentifierKind, value: string | null | undefined, userId: string) => {
    if (!value) return;
    const m = groups[kind];
    const set = m.get(value) ?? new Set<string>();
    set.add(userId);
    m.set(value, set);
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

  // Construction du graphe : tout identifiant partagé par ≥2 comptes crée des arêtes.
  const uf = new UnionFind();
  const evidence = new Map<string, Set<IdentifierKind>>(); // rootUser → types d'arêtes
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

  // Composantes connexes → clusters.
  const clusters = new Map<string, string[]>();
  for (const user of uf.members()) {
    const root = uf.find(user);
    const arr = clusters.get(root) ?? [];
    arr.push(user);
    clusters.set(root, arr);
  }

  // États des comptes (banni / restreint).
  const allUsers = [...clusters.values()].flat();
  const states = await prisma.user.findMany({
    where: { id: { in: allUsers } },
    select: { id: true, bannedAt: true, restrictedAt: true },
  });
  const stateById = new Map(states.map((s) => [s.id, s]));

  let confirmedCount = 0;
  let restrictedCount = 0;

  for (const [root, members] of clusters) {
    if (members.length < 2) continue;
    const kinds = [...(evidence.get(root) ?? [])];
    const hasBad = members.some((u) => {
      const s = stateById.get(u);
      return s?.bannedAt || s?.restrictedAt;
    });
    // Confirmé : contient un compte déjà sanctionné, OU large + multi-signal.
    const confirmed = hasBad || (members.length >= MIN_CLUSTER && kinds.length >= 2);
    if (!confirmed) continue;

    confirmedCount++;
    console.log(
      `\n⚠️  Cluster ${root.slice(0, 8)} — ${members.length} comptes` +
        ` | liens: ${kinds.join(", ")}${hasBad ? " | contient un compte sanctionné" : ""}`,
    );
    console.log(`   comptes: ${members.join(", ")}`);

    if (APPLY) {
      const toRestrict = members.filter((u) => {
        const s = stateById.get(u);
        return s && !s.bannedAt && !s.restrictedAt;
      });
      if (toRestrict.length > 0) {
        await prisma.user.updateMany({
          where: { id: { in: toRestrict } },
          data: {
            restrictedAt: new Date(),
            adminNote: `[FRAUD_RING] cluster ${root.slice(0, 8)} (${members.length} comptes, liens: ${kinds.join("/")})`,
          } as any,
        });
        restrictedCount += toRestrict.length;
        console.log(`   → ${toRestrict.length} compte(s) restreint(s).`);
      }
    }
  }

  console.log(
    `\n${confirmedCount} cluster(s) confirmé(s).` +
      (APPLY
        ? ` ${restrictedCount} compte(s) restreint(s).`
        : " Mode lecture — relancer avec --apply pour restreindre."),
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

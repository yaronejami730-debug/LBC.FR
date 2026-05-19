import { prisma } from "@/lib/prisma";
import { decideForUser } from "@/lib/behavioral/decide";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;
const MAX_ROWS = 50;

type Row = {
  userId: string;
  email: string;
  name: string;
  reason: string;          // raison friction ou "intent_only"
  intent: number;
  friction: number;
  proba: number;
  canal: string;
  action: string;
  heure: string;
  hot: boolean;
  decisionReason: string;  // raison du skip si pas d'envoi
  envoyer: boolean;
};

async function fetchBatch(): Promise<Row[]> {
  const now = Date.now();
  const ago7 = new Date(now - 7 * DAY_MS);
  const ago30 = new Date(now - 30 * DAY_MS);

  const [draftUsers, postVisitors] = await Promise.all([
    prisma.draft.findMany({
      where: { updatedAt: { gte: ago30 }, completeness: { gt: 0 } },
      select: { userId: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.userEvent.findMany({
      where: {
        kind: "page_view",
        path: { startsWith: "/post" },
        userId: { not: null },
        createdAt: { gte: ago7 },
      },
      select: { userId: true },
      distinct: ["userId"],
      take: 200,
    }),
  ]);

  const ids = new Set<string>();
  for (const d of draftUsers) ids.add(d.userId);
  for (const e of postVisitors) if (e.userId) ids.add(e.userId);

  const list = [...ids].slice(0, MAX_ROWS);
  const users = await prisma.user.findMany({
    where: { id: { in: list } },
    select: { id: true, email: true, name: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  const rows: Row[] = [];
  for (const userId of list) {
    const decision = await decideForUser(prisma, userId);
    const u = byId.get(userId);
    if (!u) continue;
    if (decision.envoyer) {
      rows.push({
        userId,
        email: u.email,
        name: u.name,
        reason: decision.raison,
        intent: decision.niveau_intention,
        friction: decision.niveau_friction,
        proba: decision.probabilite_publication,
        canal: decision.canal,
        action: decision.action_recommandee,
        heure: decision.heure_ideale,
        hot: decision.moment_emotionnel_detecte,
        decisionReason: "envoyer",
        envoyer: true,
      });
    } else {
      rows.push({
        userId,
        email: u.email,
        name: u.name,
        reason: decision.debug?.friction.reason ?? "none",
        intent: decision.niveau_intention ?? 0,
        friction: decision.niveau_friction ?? 0,
        proba: 0,
        canal: "—",
        action: "—",
        heure: "—",
        hot: false,
        decisionReason: decision.raison,
        envoyer: false,
      });
    }
  }
  rows.sort((a, b) => b.proba - a.proba);
  return rows;
}

export default async function BehavioralPage() {
  const rows = await fetchBatch();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#191c1e] font-headline">
          Moteur comportemental
        </h1>
        <p className="text-sm text-[#777683] mt-1">
          Décisions de nudge en temps réel pour les candidats actifs
          (brouillon vivant ou visites /post 7 j). Lecture seule.
        </p>
      </div>

      <div className="bg-white border border-[#eceef0] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f7fb] text-[#5a5b6e] text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Utilisateur</th>
              <th className="text-left px-4 py-3">Raison</th>
              <th className="text-right px-4 py-3">Intent</th>
              <th className="text-right px-4 py-3">Friction</th>
              <th className="text-right px-4 py-3">Proba</th>
              <th className="text-left px-4 py-3">Canal</th>
              <th className="text-left px-4 py-3">Action</th>
              <th className="text-left px-4 py-3">Heure</th>
              <th className="text-left px-4 py-3">Décision</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-[#777683]">
                  Aucun candidat actif.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.userId} className="border-t border-[#eceef0]">
                <td className="px-4 py-2">
                  <div className="font-semibold text-[#191c1e]">{r.name}</div>
                  <div className="text-xs text-[#777683]">{r.email}</div>
                </td>
                <td className="px-4 py-2 text-[#191c1e]">{r.reason}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.intent}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.friction}</td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold">
                  {r.envoyer ? r.proba : "—"}
                </td>
                <td className="px-4 py-2">{r.canal}</td>
                <td className="px-4 py-2 text-[#191c1e]">{r.action}</td>
                <td className="px-4 py-2 tabular-nums">{r.heure}</td>
                <td className="px-4 py-2">
                  {r.envoyer ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.hot ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"}`}>
                      {r.hot ? "🔥 envoyer" : "envoyer"}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                      {r.decisionReason}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

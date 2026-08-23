/**
 * « Comment nous avez-vous connus ? »
 *
 * ── Pourquoi ce module existe ─────────────────────────────────────────────
 *
 * Les statistiques d'audience racontent le *dernier* clic : un visiteur qui a
 * découvert Deal&Co dans une vidéo, cherché « dealandcompany » deux jours plus
 * tard et atterri par Google est compté comme trafic de recherche. La vidéo,
 * elle, n'apparaît nulle part. Et depuis que les assistants conversationnels
 * recommandent des sites sans transmettre de référent, une part entière de
 * l'acquisition est devenue invisible à la mesure automatique.
 *
 * La seule source qui sache d'où vient quelqu'un, c'est cette personne. D'où
 * cette question posée directement, et une réponse en un clic.
 *
 * ── Ce que le module ne fait pas ──────────────────────────────────────────
 *
 * Il n'invente aucune attribution. Une personne qui ne répond pas reste sans
 * réponse : elle n'est pas répartie au prorata des autres, elle n'est pas
 * devinée d'après son référent. Le taux de réponse est affiché à côté des
 * résultats, parce qu'un camembert sur 12 réponses ne se lit pas comme le même
 * camembert sur 400.
 */
import { prisma } from "@/lib/prisma";
import {
  ATTRIBUTION_KIND,
  ATTRIBUTION_SOURCES,
  isAttributionSource,
} from "@/lib/attribution-sources";

// Ré-export : un appelant serveur n'a pas à savoir que le catalogue vit dans un
// fichier séparé pour des raisons de bundle.
export * from "@/lib/attribution-sources";

/**
 * Enregistre une réponse.
 *
 * Écriture en ajout, jamais en remplacement : si quelqu'un revient corriger son
 * choix, les deux lignes coexistent et c'est la plus récente qui compte. On sait
 * ainsi qu'un avis a changé, ce qu'un écrasement effacerait.
 */
export async function recordAttribution(input: {
  userId: string;
  source: string;
  detail?: string | null;
}): Promise<void> {
  if (!isAttributionSource(input.source)) return;

  await prisma.userEvent.create({
    data: {
      userId: input.userId,
      kind: ATTRIBUTION_KIND,
      path: "/sondage",
      meta: JSON.stringify({
        source: input.source,
        // Champ libre borné : c'est une précision, pas un formulaire de contact.
        detail: input.detail?.trim().slice(0, 200) || null,
      }),
    },
  });
}

/** La réponse d'une personne, si elle a répondu. */
export async function attributionOf(userId: string): Promise<{ source: string; detail: string | null } | null> {
  const row = await prisma.userEvent.findFirst({
    where: { userId, kind: ATTRIBUTION_KIND },
    orderBy: { createdAt: "desc" },
    select: { meta: true },
  });
  if (!row?.meta) return null;
  try {
    const parsed = JSON.parse(row.meta) as { source?: string; detail?: string | null };
    return parsed.source ? { source: parsed.source, detail: parsed.detail ?? null } : null;
  } catch {
    return null;
  }
}

export type AttributionReport = {
  /** Une ligne par source proposée, y compris celles restées à zéro. */
  rows: { key: string; label: string; count: number; share: number }[];
  /** Personnes ayant répondu — une par personne, la dernière réponse faisant foi. */
  answers: number;
  /** Personnes sollicitées, telles que le script d'envoi les a comptées. */
  invited: number;
  responseRate: number | null;
  /** Ce que les gens ont écrit dans « Autrement », du plus récent au plus ancien. */
  freeText: { detail: string; at: Date }[];
};

/**
 * Agrège les réponses.
 *
 * Une personne, une voix : c'est la dernière réponse de chacun qui est comptée,
 * pas le nombre de clics. Sans cela, quelqu'un qui hésite entre deux sources
 * pèserait deux fois.
 */
export async function attributionReport(invited?: number): Promise<AttributionReport> {
  const events = await prisma.userEvent.findMany({
    where: { kind: ATTRIBUTION_KIND, userId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { userId: true, meta: true, createdAt: true },
    take: 20_000,
  });

  const latest = new Map<string, { source: string; detail: string | null; at: Date }>();
  for (const e of events) {
    if (!e.userId || latest.has(e.userId)) continue; // déjà vu = plus récent
    try {
      const parsed = JSON.parse(e.meta ?? "{}") as { source?: string; detail?: string | null };
      if (parsed.source) {
        latest.set(e.userId, { source: parsed.source, detail: parsed.detail ?? null, at: e.createdAt });
      }
    } catch {
      /* une ligne illisible ne doit pas emporter le rapport */
    }
  }

  const counts = new Map<string, number>();
  const freeText: { detail: string; at: Date }[] = [];
  for (const answer of latest.values()) {
    counts.set(answer.source, (counts.get(answer.source) ?? 0) + 1);
    if (answer.detail) freeText.push({ detail: answer.detail, at: answer.at });
  }

  const answers = latest.size;

  return {
    rows: ATTRIBUTION_SOURCES.map((s) => {
      const count = counts.get(s.key) ?? 0;
      return { key: s.key, label: s.label, count, share: answers > 0 ? (count / answers) * 100 : 0 };
    }).sort((a, b) => b.count - a.count),
    answers,
    invited: invited ?? 0,
    responseRate: invited && invited > 0 ? (answers / invited) * 100 : null,
    freeText: freeText.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 50),
  };
}

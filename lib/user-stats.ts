/**
 * Délai de réponse moyen d'un vendeur.
 *
 * ── Pourquoi cette version ────────────────────────────────────────────────
 *
 * La précédente chargeait **toutes les conversations du vendeur avec tous leurs
 * messages**, puis calculait la moyenne en mémoire. Deux allers-retours base,
 * un volume qui croît avec l'ancienneté du compte, et aucun cache : sur un
 * vendeur à 22 conversations — pas un gros compte — la mesure du 23/08/2026
 * donnait 392 ms, à comparer aux 87 ms de latence d'un aller-retour. C'était le
 * premier poste du temps de rendu d'une fiche annonce, pour une ligne de texte
 * du type « répond en 3 h ».
 *
 * Trois changements :
 *
 *  - **le calcul descend dans PostgreSQL.** Une fonction de fenêtrage compare
 *    chaque message au précédent de la même conversation ; seule la moyenne
 *    remonte. Un aller-retour, deux nombres transportés au lieu de milliers de
 *    lignes ;
 *  - **la fenêtre est bornée à 90 jours.** Un délai de réponse est une
 *    information sur le vendeur d'aujourd'hui. Une moyenne qui traîne les
 *    échanges d'il y a deux ans est à la fois plus lente à calculer et moins
 *    vraie ;
 *  - **le résultat est mis en cache une heure.** Cette valeur ne bouge
 *    pratiquement pas d'un message au suivant, et la fiche annonce est la page
 *    la plus demandée du site.
 */
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";

/** Au-delà, les échanges ne disent plus rien du vendeur d'aujourd'hui. */
const WINDOW_DAYS = 90;
/**
 * Nombre de réponses en dessous duquel on n'affiche rien.
 *
 * Une seule réponse rapide ne fait pas un vendeur réactif, et afficher
 * « répond en 2 min » sur un échantillon de un est une promesse qu'on ne tient
 * pas. Mieux vaut ne rien dire.
 */
const MIN_SAMPLE = 2;

type Row = { avg_seconds: number | null; sample: bigint | number | null };

/**
 * Moyenne des délais de réponse, calculée en base.
 *
 * `LAG` regarde le message précédent de la même conversation. On ne retient que
 * les couples « quelqu'un écrit → le vendeur répond » : les messages consécutifs
 * du vendeur ne sont pas des réponses, et les compter écraserait la moyenne vers
 * zéro pour ceux qui écrivent en plusieurs fois.
 */
async function computeResponseTime(userId: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<Row[]>`
    WITH ordered AS (
      SELECT
        m."senderId",
        m."createdAt",
        LAG(m."senderId")  OVER (PARTITION BY m."conversationId" ORDER BY m."createdAt") AS prev_sender,
        LAG(m."createdAt") OVER (PARTITION BY m."conversationId" ORDER BY m."createdAt") AS prev_at
      FROM "Message" m
      JOIN "ConversationParticipant" cp
        ON cp."conversationId" = m."conversationId"
       AND cp."userId" = ${userId}
      WHERE m."createdAt" >= NOW() - ${`${WINDOW_DAYS} days`}::interval
    )
    SELECT
      AVG(EXTRACT(EPOCH FROM ("createdAt" - prev_at))) AS avg_seconds,
      COUNT(*)                                          AS sample
    FROM ordered
    WHERE prev_sender IS NOT NULL
      AND prev_sender <> ${userId}
      AND "senderId"   =  ${userId}
  `.catch(() => [] as Row[]);

  const row = rows[0];
  if (!row?.avg_seconds) return null;

  const sample = Number(row.sample ?? 0);
  if (sample < MIN_SAMPLE) return null;

  return formatDelay(Number(row.avg_seconds) * 1000);
}

/** Met un délai en mots. Approximatif à dessein : personne n'attend la minute près. */
export function formatDelay(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} mins`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;

  return "Quelques jours";
}

/**
 * Version mise en cache — celle qu'utilisent les pages.
 *
 * Une heure : le délai moyen d'un vendeur ne change pas d'un message au
 * suivant, et la fiche annonce est la page la plus demandée du site. Le tag
 * permet de forcer le recalcul si le besoin apparaît.
 */
export const getUserResponseTime = unstable_cache(
  computeResponseTime,
  ["user-response-time-v2"],
  { revalidate: 3600, tags: ["messages"] },
);

/**
 * Version directe, sans cache.
 *
 * `unstable_cache` exige un contexte de requête Next : un script ou une tâche
 * planifiée qui appellerait la version cachée échouerait à l'exécution.
 */
export { computeResponseTime as getUserResponseTimeUncached };

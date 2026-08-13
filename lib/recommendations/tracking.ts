/**
 * Attribution des ouvertures et des clics aux recommandations envoyées.
 *
 * Le tracking d'email générique (`EmailEvent`) sait qu'un compte a ouvert un
 * email de type `listing_recommendation`. Il ne sait pas *quelles annonces* cet
 * email contenait — cette information est dans `ListingRecommendationLog`.
 * Recoller les deux permet trois choses : mesurer une campagne, classer les
 * annonces les plus cliquées, et surtout nourrir le signal négatif « envoyé,
 * jamais ouvert » qui fait baisser l'intérêt catégoriel.
 *
 * Tout est en meilleur effort : une attribution ratée ne doit jamais empêcher
 * le pixel de répondre ni la redirection d'aboutir.
 */

import { prisma } from "@/lib/prisma";
import { RECO_EMAIL_TYPE } from "./config";

/** Fenêtre d'attribution : au-delà, l'ouverture concerne un autre envoi. */
const ATTRIBUTION_WINDOW_DAYS = 30;

/** `/annonce/<id>/<slug>` → `<id>`. */
function listingIdFromUrl(url: string): string | null {
  const match = url.match(/\/annonce\/([^/?#]+)/);
  return match ? match[1] : null;
}

/**
 * Enregistre une ouverture : toutes les annonces du dernier envoi à ce compte
 * sont marquées comme vues. On ne peut pas faire plus fin — un pixel dit que
 * l'email a été affiché, pas quelle carte a été regardée.
 */
async function markOpened(userId: string, at: Date): Promise<void> {
  const since = new Date(at.getTime() - ATTRIBUTION_WINDOW_DAYS * 86_400_000);

  const last = await prisma.listingRecommendationLog.findFirst({
    where: { userId, sentAt: { gte: since } },
    orderBy: { sentAt: "desc" },
    select: { campaignId: true, sentAt: true },
  });
  if (!last?.campaignId) return;

  await prisma.listingRecommendationLog.updateMany({
    where: { userId, campaignId: last.campaignId, openedAt: null },
    data: { openedAt: at },
  });
}

/**
 * Enregistre un clic sur une annonce précise. Un clic vaut ouverture : les
 * pixels sont massivement bloqués (Apple Mail Privacy Protection, messageries
 * d'entreprise), et compter comme « ignoré » un email qui a produit une visite
 * fausserait le signal négatif dans le mauvais sens.
 */
async function markClicked(userId: string, url: string, at: Date): Promise<void> {
  const listingId = listingIdFromUrl(url);
  if (!listingId) return;

  await prisma.listingRecommendationLog.updateMany({
    where: { userId, listingId, sentAt: { not: null } },
    data: { clickedAt: at, openedAt: at },
  });
}

/**
 * Point d'entrée appelé par `/api/email/open` et `/api/email/click`.
 * Ne lève jamais, ne bloque jamais la réponse HTTP.
 */
export function attributeRecommendationEvent(event: {
  userId?: string | null;
  emailType: string;
  kind: "open" | "click";
  url?: string | null;
}): void {
  if (event.emailType !== RECO_EMAIL_TYPE || !event.userId) return;

  const at = new Date();
  const task =
    event.kind === "click" && event.url
      ? markClicked(event.userId, event.url, at)
      : markOpened(event.userId, at);

  task.catch((err) => console.error("[reco] attribution échouée", err));
}

/**
 * Décideur du moteur comportemental — assemble les signaux observables d'un
 * utilisateur et émet la sortie JSON exigée par le master prompt #2 :
 * faut-il pousser un nudge maintenant, sur quel canal, avec quel message ?
 *
 * Garde-fous (master prompt #2, section TIMING) :
 *   - max 1 relance / 3 j
 *   - max 2 relances / semaine
 *   - respect du `marketingConsent`
 *   - jamais sur un compte banni ou restreint
 *
 * Aucune IA générative : signaux observables → score logistique → décision
 * déterministe → message court paramétré par la raison de friction.
 */

import type { PrismaClient } from "@prisma/client";
import { computeIntentScore, type IntentResult } from "@/lib/behavioral/intent-score";
import {
  detectFriction,
  type FrictionReason,
  type FrictionResult,
} from "@/lib/behavioral/friction-detect";
import { pickBestSendHour, type TimingResult } from "@/lib/behavioral/timing";

const NUDGE_EMAIL_TYPE = "publish_nudge";
const COOLDOWN_DAYS = 3;
const WEEKLY_CAP = 2;
const MIN_INTENT_TO_NUDGE = 30;
const MIN_FRICTION_TO_NUDGE = 30;

export type NudgeAction =
  | "reprendre_brouillon"
  | "completer_brouillon"
  | "publication_simplifiee"
  | "decouvrir_publication"
  | "republier_facilement"
  | "encourager_publication";

export type NudgeChannel = "email" | "push";

export type NudgeDecisionGo = {
  envoyer: true;
  canal: NudgeChannel;
  moment_emotionnel_detecte: boolean;
  niveau_intention: number;
  niveau_friction: number;
  probabilite_publication: number;
  raison: FrictionReason | "intent_only";
  action_recommandee: NudgeAction;
  heure_ideale: string;
  message: string;
  debug: {
    intent: IntentResult;
    friction: FrictionResult;
    timing: TimingResult;
  };
};

export type NudgeDecisionSkip = {
  envoyer: false;
  raison:
    | "aucune_intention_reelle"
    | "cooldown_3j"
    | "cap_hebdomadaire"
    | "consentement_refuse"
    | "compte_inactif"
    | "compte_restreint"
    | "user_introuvable";
  niveau_intention?: number;
  niveau_friction?: number;
  debug?: {
    intent: IntentResult;
    friction: FrictionResult;
  };
};

export type NudgeDecision = NudgeDecisionGo | NudgeDecisionSkip;

const DAY_MS = 86_400_000;

/** Message court par raison de friction (master prompt #7). */
function messageFor(action: NudgeAction, category: string | null): string {
  const cat = category ? ` (${category})` : "";
  switch (action) {
    case "reprendre_brouillon":
      return `Votre annonce${cat} est presque prête.`;
    case "completer_brouillon":
      return `Quelques détails et votre annonce${cat} est en ligne.`;
    case "publication_simplifiee":
      return "Publier prend moins d'une minute.";
    case "decouvrir_publication":
      return "Et si vous mettiez quelque chose à vendre ?";
    case "republier_facilement":
      return "Republier une annonce : tout est pré-rempli pour vous.";
    case "encourager_publication":
      return "Le moment idéal pour publier votre annonce.";
  }
}

function actionFor(
  reason: FrictionReason,
  intentLevel: IntentResult["level"],
): NudgeAction {
  switch (reason) {
    case "draft_abandoned_high":
      return "reprendre_brouillon";
    case "draft_abandoned_low":
      return "completer_brouillon";
    case "post_page_loop":
      return "publication_simplifiee";
    case "interested_non_publisher":
      return "decouvrir_publication";
    case "stale_publisher":
      return "republier_facilement";
    case "none":
      return intentLevel === "très fort" || intentLevel === "fort"
        ? "encourager_publication"
        : "decouvrir_publication";
  }
}

/**
 * Décide si l'utilisateur `userId` doit recevoir un nudge maintenant.
 *
 * Lecture seule — aucune écriture (ni envoi d'email, ni enregistrement).
 * L'appelant est responsable d'envoyer puis d'enregistrer le `sent` event.
 */
export async function decideForUser(
  prisma: PrismaClient,
  userId: string,
): Promise<NudgeDecision> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      createdAt: true,
      lastLoginAt: true,
      isPro: true,
      marketingConsent: true,
      bannedAt: true,
      restrictedAt: true,
    },
  });
  if (!user) return { envoyer: false, raison: "user_introuvable" };
  if (user.bannedAt || user.restrictedAt) {
    return { envoyer: false, raison: "compte_restreint" };
  }
  if (!user.marketingConsent) {
    return { envoyer: false, raison: "consentement_refuse" };
  }

  const now = Date.now();
  const ago7 = new Date(now - 7 * DAY_MS);
  const ago30 = new Date(now - 30 * DAY_MS);
  const ago90 = new Date(now - 90 * DAY_MS);
  const cooldownCutoff = new Date(now - COOLDOWN_DAYS * DAY_MS);

  const [
    draft,
    favoritesCount,
    savedSearchesCount,
    ownListingsCount,
    publishesLast30d,
    listingViewsCount7d,
    postPageVisits7d,
    waitlistEntries,
    recentOpens,
    nudgesLastWeek,
    nudgesSinceCooldown,
    activePushSubs,
  ] = await Promise.all([
    prisma.draft.findUnique({ where: { userId } }),
    prisma.favorite.count({ where: { userId, createdAt: { gte: ago30 } } }),
    prisma.savedSearch.count({ where: { userId } }),
    prisma.listing.count({ where: { userId, deletedAt: null } }),
    prisma.listing.count({
      where: { userId, createdAt: { gte: ago30 }, deletedAt: null },
    }),
    prisma.userEvent.count({
      where: { userId, kind: "listing_view", createdAt: { gte: ago7 } },
    }),
    prisma.userEvent.count({
      where: {
        userId,
        kind: "page_view",
        path: { startsWith: "/post" },
        createdAt: { gte: ago7 },
      },
    }),
    prisma.waitlist.count({ where: { email: user.email } }),
    prisma.emailEvent.findMany({
      where: { userId, kind: "open", createdAt: { gte: ago90 } },
      select: { createdAt: true },
      take: 500,
    }),
    prisma.emailEvent.count({
      where: {
        userId,
        kind: "sent",
        emailType: NUDGE_EMAIL_TYPE,
        createdAt: { gte: ago7 },
      },
    }),
    prisma.emailEvent.count({
      where: {
        userId,
        kind: "sent",
        emailType: NUDGE_EMAIL_TYPE,
        createdAt: { gte: cooldownCutoff },
      },
    }),
    prisma.pushSubscription.count({
      where: { userId, disabledAt: null },
    }),
  ]);

  const daysSinceSignup = Math.max(
    0,
    (now - user.createdAt.getTime()) / DAY_MS,
  );
  const daysSinceLastLogin = user.lastLoginAt
    ? (now - user.lastLoginAt.getTime()) / DAY_MS
    : daysSinceSignup;

  const draftCompleteness = draft?.completeness ?? 0;
  const draftAgeHours = draft
    ? (now - draft.updatedAt.getTime()) / 3_600_000
    : null;
  const draftCategory = draft?.category ?? null;

  const intent = computeIntentScore({
    draftCompleteness,
    draftAgeHours,
    ownListingsCount,
    favoritesCount,
    savedSearchesCount,
    listingViewsCount7d,
    waitlistEntries,
    postPageVisits7d,
    daysSinceSignup,
    daysSinceLastLogin,
    isPro: user.isPro,
  });

  const friction = detectFriction({
    draftCompleteness,
    draftAgeHours,
    draftCategory,
    postPageVisits7d,
    publishesLast30d,
    ownListingsCount,
    daysSinceSignup,
    favoritesCount,
    savedSearchesCount,
  });

  // Filtres précoces — pas la peine de calculer un timing si on ne va pas envoyer.
  if (intent.score < MIN_INTENT_TO_NUDGE && friction.level < MIN_FRICTION_TO_NUDGE) {
    return {
      envoyer: false,
      raison: "aucune_intention_reelle",
      niveau_intention: intent.score,
      niveau_friction: friction.level,
      debug: { intent, friction },
    };
  }

  if (daysSinceLastLogin > 60) {
    return {
      envoyer: false,
      raison: "compte_inactif",
      niveau_intention: intent.score,
      niveau_friction: friction.level,
      debug: { intent, friction },
    };
  }

  if (nudgesSinceCooldown > 0) {
    return {
      envoyer: false,
      raison: "cooldown_3j",
      niveau_intention: intent.score,
      niveau_friction: friction.level,
      debug: { intent, friction },
    };
  }

  if (nudgesLastWeek >= WEEKLY_CAP) {
    return {
      envoyer: false,
      raison: "cap_hebdomadaire",
      niveau_intention: intent.score,
      niveau_friction: friction.level,
      debug: { intent, friction },
    };
  }

  const timing = pickBestSendHour(recentOpens.map((o) => o.createdAt));
  const action = actionFor(friction.reason, intent.level);
  const reason: FrictionReason | "intent_only" =
    friction.reason === "none" ? "intent_only" : friction.reason;

  // Choix canal : push si l'utilisateur l'a activé ET que le moment est chaud
  // (brouillon avancé abandonné ou intent très fort). Sinon email — moins
  // intrusif, recule les chances de saturer.
  const hotMoment =
    friction.reason === "draft_abandoned_high" || intent.level === "très fort";
  const canal: NudgeChannel =
    activePushSubs > 0 && hotMoment ? "push" : "email";

  // Probabilité de publication = intent dominant, friction = boost si actionnable.
  const proba = Math.max(
    intent.score,
    Math.round(intent.score * 0.7 + friction.level * 0.3),
  );

  // Moment émotionnel : brouillon récent + intent fort = fenêtre d'or.
  const momentDetecte =
    intent.score >= 60 &&
    (friction.reason === "draft_abandoned_high" || draftAgeHours !== null && draftAgeHours < 6);

  return {
    envoyer: true,
    canal,
    moment_emotionnel_detecte: momentDetecte,
    niveau_intention: intent.score,
    niveau_friction: friction.level,
    probabilite_publication: Math.min(100, proba),
    raison: reason,
    action_recommandee: action,
    heure_ideale: timing.bestHourLabel,
    message: messageFor(action, draftCategory),
    debug: { intent, friction, timing },
  };
}

export { NUDGE_EMAIL_TYPE };

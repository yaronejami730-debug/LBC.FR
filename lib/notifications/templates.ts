// Templates de notifications push, centralisés et typés.
// Chaque template définit type / title / body / deepLink avec variables {{var}}.
// Branchés via sendPushNotification() — voir ./send.ts.

export type NotificationType =
  // Modération annonce
  | "listing_approved"
  | "listing_rejected"
  | "listing_pending"
  | "listing_suspended"
  | "listing_expired"
  | "listing_expiring"
  // Messagerie
  | "new_message"
  | "listing_message"
  | "message_seen"
  // Favoris / interactions
  | "listing_favorited"
  | "listing_trending"
  // Alertes
  | "saved_alert_match"
  | "multiple_alert_matches"
  // Sécurité
  | "password_changed"
  | "suspicious_login"
  | "email_verified"
  // Onboarding
  | "welcome"
  | "first_listing"
  | "complete_profile"
  // Paiement
  | "payment_success"
  | "payment_failed"
  | "boost_enabled"
  // Avis
  | "new_review"
  | "badge_earned"
  // Marketing
  | "user_comeback"
  | "boost_discount";

export type NotificationTemplate = {
  type: NotificationType;
  title: string;
  body: string;
  deepLink?: string;
};

export const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  // ── Modération ─────────────────────────────────────────────────────────────
  listing_approved: {
    type: "listing_approved",
    title: "Annonce validée 🎉",
    body: "Votre annonce « {{listingTitle}} » est maintenant en ligne.",
    deepLink: "/annonce/{{listingId}}",
  },
  listing_rejected: {
    type: "listing_rejected",
    title: "Annonce refusée",
    body: "Votre annonce « {{listingTitle}} » n'a pas été acceptée. Consultez les détails pour en savoir plus.",
    deepLink: "/(tabs)/profile",
  },
  listing_pending: {
    type: "listing_pending",
    title: "Annonce en cours de vérification ⏳",
    body: "« {{listingTitle}} » sera publiée après validation.",
    deepLink: "/annonce/{{listingId}}",
  },
  listing_suspended: {
    type: "listing_suspended",
    title: "Annonce suspendue ⚠️",
    body: "Votre annonce « {{listingTitle}} » a été temporairement suspendue.",
    deepLink: "/settings/aide",
  },
  listing_expired: {
    type: "listing_expired",
    title: "Annonce expirée",
    body: "Votre annonce « {{listingTitle}} » a expiré. Republiez-la en un clic.",
    deepLink: "/(tabs)/profile",
  },
  listing_expiring: {
    type: "listing_expiring",
    title: "Annonce bientôt expirée ⏳",
    body: "Votre annonce « {{listingTitle}} » expire dans {{daysLeft}} jours.",
    deepLink: "/annonce/{{listingId}}",
  },

  // ── Messagerie ─────────────────────────────────────────────────────────────
  new_message: {
    type: "new_message",
    title: "Nouveau message 💬",
    body: "{{senderName}} vous a envoyé un message.",
    deepLink: "/messages/{{conversationId}}",
  },
  listing_message: {
    type: "listing_message",
    title: "Quelqu'un s'intéresse à votre annonce 👀",
    body: "{{senderName}} a envoyé un message pour « {{listingTitle}} ».",
    deepLink: "/messages/{{conversationId}}",
  },
  message_seen: {
    type: "message_seen",
    title: "Message lu 👌",
    body: "{{receiverName}} a vu votre message.",
    deepLink: "/messages/{{conversationId}}",
  },

  // ── Favoris / interactions ─────────────────────────────────────────────────
  listing_favorited: {
    type: "listing_favorited",
    title: "Votre annonce plaît 🔥",
    body: "Quelqu'un a ajouté « {{listingTitle}} » à ses favoris.",
    deepLink: "/annonce/{{listingId}}",
  },
  listing_trending: {
    type: "listing_trending",
    title: "Annonce populaire 🚀",
    body: "Votre annonce « {{listingTitle}} » reçoit beaucoup de vues aujourd'hui.",
    deepLink: "/annonce/{{listingId}}",
  },

  // ── Alertes ────────────────────────────────────────────────────────────────
  saved_alert_match: {
    type: "saved_alert_match",
    title: "Nouvelle annonce disponible 🔔",
    body: "Une nouvelle annonce correspond à votre alerte « {{alertName}} ».",
    deepLink: "/annonce/{{listingId}}",
  },
  multiple_alert_matches: {
    type: "multiple_alert_matches",
    title: "{{count}} nouvelles annonces",
    body: "De nouvelles annonces correspondent à votre recherche « {{alertName}} ».",
    deepLink: "/(tabs)/alertes",
  },

  // ── Sécurité ───────────────────────────────────────────────────────────────
  password_changed: {
    type: "password_changed",
    title: "Mot de passe modifié 🔐",
    body: "Votre mot de passe a bien été mis à jour.",
    deepLink: "/settings/securite",
  },
  suspicious_login: {
    type: "suspicious_login",
    title: "Connexion inhabituelle ⚠️",
    body: "Une connexion inhabituelle a été détectée sur votre compte.",
    deepLink: "/settings/securite",
  },
  email_verified: {
    type: "email_verified",
    title: "Email vérifié ✅",
    body: "Votre adresse email a bien été confirmée.",
  },

  // ── Onboarding ─────────────────────────────────────────────────────────────
  welcome: {
    type: "welcome",
    title: "Bienvenue sur Deal & Co 👋",
    body: "Commencez dès maintenant à acheter et vendre près de chez vous.",
    deepLink: "/(tabs)",
  },
  first_listing: {
    type: "first_listing",
    title: "Prêt à vendre ? 🚀",
    body: "Publiez votre première annonce en moins de 2 minutes.",
    deepLink: "/(tabs)/post",
  },
  complete_profile: {
    type: "complete_profile",
    title: "Complétez votre profil ✨",
    body: "Ajoutez une photo et quelques informations pour inspirer confiance.",
    deepLink: "/settings/informations-personnelles",
  },

  // ── Paiement ───────────────────────────────────────────────────────────────
  payment_success: {
    type: "payment_success",
    title: "Paiement confirmé ✅",
    body: "Votre paiement de {{amount}}€ a bien été validé.",
  },
  payment_failed: {
    type: "payment_failed",
    title: "Paiement refusé ❌",
    body: "Impossible de traiter votre paiement. Réessayez plus tard.",
    deepLink: "/settings/aide",
  },
  boost_enabled: {
    type: "boost_enabled",
    title: "Boost activé 🚀",
    body: "Votre annonce « {{listingTitle}} » est maintenant mise en avant.",
    deepLink: "/annonce/{{listingId}}",
  },

  // ── Avis ───────────────────────────────────────────────────────────────────
  new_review: {
    type: "new_review",
    title: "Nouvel avis ⭐",
    body: "{{reviewerName}} vous a laissé un avis.",
    deepLink: "/(tabs)/profile",
  },
  badge_earned: {
    type: "badge_earned",
    title: "Nouveau badge débloqué 🏅",
    body: "Vous avez obtenu le badge « {{badgeName}} ».",
  },

  // ── Marketing ──────────────────────────────────────────────────────────────
  user_comeback: {
    type: "user_comeback",
    title: "De nouvelles annonces vous attendent 👀",
    body: "Revenez découvrir les dernières bonnes affaires près de chez vous.",
    deepLink: "/(tabs)",
  },
  boost_discount: {
    type: "boost_discount",
    title: "Offre spéciale 🔥",
    body: "Boostez votre annonce avec -30% aujourd'hui seulement.",
    deepLink: "/(tabs)/profile",
  },
};

// Interpolation {{var}} — laisse vide si la variable est manquante.
export function interpolate(template: string, vars: Record<string, string | number | undefined>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

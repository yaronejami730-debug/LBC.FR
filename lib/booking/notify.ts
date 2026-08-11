/**
 * Points d'ancrage des notifications de réservation.
 *
 * L'architecture est posée, les canaux ne sont pas tous branchés (§15). Le
 * choix ici est d'appeler `emit()` dès aujourd'hui aux bons endroits du code
 * métier : le jour où l'on connecte le SMS ou le rappel J-1, il n'y a qu'un
 * `case` à remplir, aucune route à rouvrir.
 *
 * Règle : une notification qui échoue ne doit jamais faire échouer la
 * réservation. Tout est encapsulé et avalé, avec trace en console.
 */
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import {
  bookingConfirmedEmail,
  bookingDeclinedEmail,
  bookingProAlertEmail,
  bookingRequestedEmail,
} from "@/lib/emails/booking";

export type BookingEventType =
  | "booking.created"
  | "booking.confirmed"
  | "booking.cancelled"
  | "booking.rescheduled"
  | "booking.reminder24h"
  | "booking.reminder1h";

export type BookingEvent = {
  type: BookingEventType;
  bookingId: string;
  profileId: string;
  /** Destinataires connus au moment de l'émission. */
  customerEmail: string;
  customerId?: string | null;
  /** Confirmation obtenue sans intervention humaine (auto-acceptation). */
  automatic?: boolean;
};

/**
 * Canaux prévus. `email` s'appuiera sur `lib/email.ts`, `push` sur
 * `lib/notifications/send.ts` + `ExpoPushToken`, `sms` reste à connecter.
 * Les rappels J-1 et H-1 seront déclenchés par un cron, comme les autres
 * échéances du projet (`app/api/cron/**`).
 */
export type NotificationChannel = "email" | "push" | "sms";

export const CHANNELS_BY_EVENT: Record<BookingEventType, NotificationChannel[]> = {
  "booking.created": ["email", "push"],
  "booking.confirmed": ["email", "push"],
  "booking.cancelled": ["email", "push"],
  "booking.rescheduled": ["email", "push"],
  "booking.reminder24h": ["email", "push"],
  "booking.reminder1h": ["push", "sms"],
};

/**
 * Émet un événement de réservation.
 *
 * Le canal e-mail est branché ; `push` et `sms` restent à connecter derrière
 * la même signature. Un échec d'envoi ne remonte jamais : une réservation
 * valide ne doit pas être perdue parce que Brevo répond mal.
 */
export async function emit(event: BookingEvent): Promise<void> {
  try {
    console.info("[booking] event", event.type, event.bookingId);
    if (CHANNELS_BY_EVENT[event.type].includes("email")) {
      await sendBookingEmails(event);
    }
  } catch (error) {
    console.error("[booking] notification échouée", event.type, error);
  }
}

/** Base publique, pour construire les liens des e-mails. */
const SITE = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";

/**
 * Rend et envoie les e-mails liés à un événement.
 *
 * Deux destinataires possibles et deux messages différents : le client suit
 * *son* rendez-vous, le professionnel a une décision à prendre. Les envoyer
 * depuis le même endroit évite qu'un des deux soit oublié en ajoutant un
 * statut.
 */
async function sendBookingEmails(event: BookingEvent): Promise<void> {
  const booking = await prisma.proBooking.findUnique({
    where: { id: event.bookingId },
    include: {
      profile: {
        select: {
          name: true,
          slug: true,
          addressLine: true,
          postalCode: true,
          user: { select: { email: true } },
        },
      },
      member: { select: { displayName: true } },
    },
  });
  if (!booking) return;

  const proName = booking.profile.name;
  const address = [booking.profile.addressLine, booking.profile.postalCode]
    .filter(Boolean)
    .join(", ");

  const common = {
    name: booking.firstName,
    proName,
    when: formatWhen(booking.startAt),
    service: booking.labelSnapshot,
    memberName: booking.member?.displayName ?? null,
    address: address || null,
    bookingsUrl: `${SITE}/mes-reservations`,
  };

  if (event.type === "booking.created") {
    // Créé et déjà confirmé = auto-acceptation. On ne lui écrit pas « votre
    // demande a été envoyée, vous recevrez une réponse » pour lui envoyer la
    // réponse dans la seconde : on lui dit directement que c'est confirmé.
    const auto = booking.status === "CONFIRMED";
    await sendEmail({
      to: booking.email,
      toName: booking.firstName,
      subject: auto ? `Rendez-vous confirmé — ${proName}` : `Demande envoyée à ${proName}`,
      html: auto
        ? bookingConfirmedEmail({ ...common, automatic: true })
        : bookingRequestedEmail(common),
      adSource: auto ? "booking-confirmed" : "booking-requested",
      userId: booking.customerId ?? undefined,
    });
  }

  if (event.type === "booking.confirmed") {
    await sendEmail({
      to: booking.email,
      toName: booking.firstName,
      subject: `Rendez-vous confirmé — ${proName}`,
      // Confirmé sans passer par PENDING = accepté automatiquement. C'est la
      // seule façon de le savoir après coup, et le client mérite de lire
      // laquelle des deux s'est produite.
      html: bookingConfirmedEmail({ ...common, automatic: event.automatic ?? false }),
      adSource: "booking-confirmed",
      userId: booking.customerId ?? undefined,
    });
  }

  if (event.type === "booking.cancelled") {
    // Une annulation par le client n'a pas à lui être renotifiée : il vient de
    // la faire. Seul le refus ou l'annulation par l'établissement l'intéresse.
    if (booking.cancelledBy === "PRO" || booking.cancelledBy === "SYSTEM") {
      await sendEmail({
        to: booking.email,
        toName: booking.firstName,
        subject: `Rendez-vous annulé — ${proName}`,
        html: bookingDeclinedEmail({ ...common, reason: booking.cancelReason }),
        adSource: "booking-declined",
        userId: booking.customerId ?? undefined,
      });
    }
  }

  // Alerte au professionnel : uniquement à la création. Les changements de
  // statut viennent de lui, le prévenir de sa propre décision serait du bruit.
  if (event.type === "booking.created") {
    const proEmail = booking.profile.user?.email;
    if (proEmail) {
      await sendEmail({
        to: proEmail,
        toName: proName,
        subject:
          booking.status === "CONFIRMED"
            ? `Nouveau rendez-vous — ${booking.firstName} ${booking.lastName}`
            : `Demande à traiter — ${booking.firstName} ${booking.lastName}`,
        html: bookingProAlertEmail({
          proName,
          customerName: `${booking.firstName} ${booking.lastName}`,
          phone: booking.phone,
          service: booking.labelSnapshot,
          when: formatWhen(booking.startAt),
          memberName: booking.member?.displayName ?? null,
          dashboardUrl: `${SITE}/profile/espace-pro/reservations`,
          autoConfirmed: booking.status === "CONFIRMED",
        }),
        adSource: "booking-pro-alert",
      });
    }
  }
}

/** « lundi 17 août à 14h30 », en heure de Paris. */
function formatWhen(date: Date): string {
  const day = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(date);
  const time = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(date);
  return `${day} à ${time.replace(":", "h")}`;
}

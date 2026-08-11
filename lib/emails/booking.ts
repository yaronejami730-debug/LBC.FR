import { baseEmail } from "./base";

/**
 * E-mails de réservation.
 *
 * Le nom de l'établissement est passé partout, jamais « le salon » : la
 * plateforme sert aussi bien un cabinet dentaire qu'un loueur de bateau, et le
 * client se souvient du nom qu'il a choisi, pas de la catégorie.
 */

type BookingMail = {
  /** Prénom du client. */
  name: string;
  /** Nom de l'établissement — celui de la fiche, tel qu'affiché au client. */
  proName: string;
  /** « lundi 17 août à 14h30 ». */
  when: string;
  /** Libellé figé de la prestation. */
  service: string;
  /** Praticien, quand le client en a choisi un. */
  memberName?: string | null;
  /** Adresse postale sur une ligne, vide si la fiche n'en a pas. */
  address?: string | null;
  bookingsUrl: string;
};

const details = ({ service, when, memberName, address, proName }: BookingMail) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="background:#f7f9fb;border-radius:14px;margin:0 0 20px;">
    <tr><td style="padding:18px 20px;font-size:15px;color:#464652;line-height:1.7;">
      <strong style="color:#1a1b25;">${service}</strong><br/>
      ${when}<br/>
      ${memberName ? `Avec ${memberName}<br/>` : ""}
      <strong style="color:#1a1b25;">${proName}</strong>${address ? `<br/>${address}` : ""}
    </td></tr>
  </table>
`;

/**
 * Demande envoyée, en attente de réponse.
 *
 * On annonce explicitement qu'un second e-mail suivra : sans cette phrase, le
 * client relance par téléphone le lendemain, ce qui est exactement le travail
 * qu'on prétendait lui épargner.
 */
export function bookingRequestedEmail(data: BookingMail): string {
  return baseEmail({
    title: `Demande envoyée à ${data.proName} — Deal & Co`,
    heading: "Votre demande est envoyée !",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${data.name}</strong>,</p>
      <p style="margin:0 0 16px;">Votre demande de rendez-vous a bien été envoyée à <strong style="color:#1a1b25;">${data.proName}</strong>.</p>
      ${details(data)}
      <p style="margin:0;">Vous recevrez un second e-mail dès que <strong style="color:#1a1b25;">${data.proName}</strong> aura confirmé le rendez-vous. Le créneau vous est réservé en attendant.</p>
    `,
    ctaLabel: "Voir mes réservations",
    ctaUrl: data.bookingsUrl,
    postCta: "Vous pouvez suivre ou annuler cette demande depuis votre espace personnel.",
  });
}

/** Confirmé — à la main par le professionnel, ou automatiquement. */
export function bookingConfirmedEmail(data: BookingMail & { automatic?: boolean }): string {
  return baseEmail({
    title: `Rendez-vous confirmé — ${data.proName}`,
    heading: "Votre rendez-vous est confirmé !",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${data.name}</strong>,</p>
      <p style="margin:0 0 16px;">${
        data.automatic
          ? `Votre rendez-vous chez <strong style="color:#1a1b25;">${data.proName}</strong> a été confirmé automatiquement.`
          : `<strong style="color:#1a1b25;">${data.proName}</strong> a confirmé votre rendez-vous.`
      }</p>
      ${details(data)}
      <p style="margin:0;">Un empêchement ? Prévenez ${data.proName} au plus tôt depuis votre espace personnel.</p>
    `,
    ctaLabel: "Voir mes réservations",
    ctaUrl: data.bookingsUrl,
  });
}

/** Refusé ou annulé par l'établissement. */
export function bookingDeclinedEmail(data: BookingMail & { reason?: string | null }): string {
  return baseEmail({
    title: `Rendez-vous annulé — ${data.proName}`,
    heading: "Votre rendez-vous n'a pas pu être retenu",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${data.name}</strong>,</p>
      <p style="margin:0 0 16px;"><strong style="color:#1a1b25;">${data.proName}</strong> n'a pas pu retenir ce rendez-vous.</p>
      ${details(data)}
      ${data.reason ? `<p style="margin:0 0 16px;">Motif indiqué : ${data.reason}</p>` : ""}
      <p style="margin:0;">Le créneau est de nouveau libre. Vous pouvez choisir un autre horaire dès maintenant.</p>
    `,
    ctaLabel: "Choisir un autre créneau",
    ctaUrl: data.bookingsUrl,
  });
}

/** Une demande vient d'arriver — e-mail au professionnel. */
export function bookingProAlertEmail({
  proName,
  customerName,
  phone,
  service,
  when,
  memberName,
  dashboardUrl,
  autoConfirmed,
}: {
  proName: string;
  customerName: string;
  phone: string;
  service: string;
  when: string;
  memberName?: string | null;
  dashboardUrl: string;
  autoConfirmed: boolean;
}): string {
  return baseEmail({
    title: `Nouvelle réservation — ${proName}`,
    heading: autoConfirmed ? "Nouveau rendez-vous" : "Nouvelle demande à traiter",
    body: `
      <p style="margin:0 0 16px;">Bonjour <strong style="color:#1a1b25;">${proName}</strong>,</p>
      <p style="margin:0 0 16px;">${
        autoConfirmed
          ? "Un rendez-vous vient d'être réservé et confirmé automatiquement."
          : "Une demande de rendez-vous attend votre réponse."
      }</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="background:#f7f9fb;border-radius:14px;margin:0 0 20px;">
        <tr><td style="padding:18px 20px;font-size:15px;color:#464652;line-height:1.7;">
          <strong style="color:#1a1b25;">${customerName}</strong> — ${phone}<br/>
          ${service}<br/>
          ${when}${memberName ? `<br/>Avec ${memberName}` : ""}
        </td></tr>
      </table>
      <p style="margin:0;">${
        autoConfirmed
          ? "Il apparaît déjà dans votre agenda."
          : "Acceptez ou refusez depuis « Mes réservations »."
      }</p>
    `,
    ctaLabel: autoConfirmed ? "Voir mon agenda" : "Traiter la demande",
    ctaUrl: dashboardUrl,
  });
}

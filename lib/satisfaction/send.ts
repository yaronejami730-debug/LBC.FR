/**
 * Envoi des campagnes dont la fenêtre de regroupement est close.
 *
 * L'ordre des opérations est le point sensible. La campagne est marquée
 * `SCHEDULED` **avant** l'appel à Brevo : si le processus meurt entre l'envoi et
 * l'écriture, la campagne reste dans un état qui interdit d'en ouvrir une autre,
 * plutôt que de repartir à `PENDING` et de produire un second email. Devant
 * l'incertitude, on préfère un avis manquant à un email en double.
 *
 * Le plafond de tentatives évite l'acharnement : une adresse qui rebondit trois
 * fois ne deviendra pas valide à la quatrième.
 */

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { isEmailAllowed } from "@/lib/notifications/preferences";
import { satisfactionEmail, satisfactionSubject } from "@/lib/emails/satisfaction";
import { satisfactionUrl } from "./token";
import { SATISFACTION_CONFIG, SATISFACTION_EMAIL_TYPE } from "./config";
import { dueCampaigns } from "./engine";

const BASE = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
const MAX_ATTEMPTS = 3;

export type SendReport = {
  examined: number;
  sent: number;
  cancelled: number;
  failed: number;
};

export async function sendDueCampaigns(
  limit: number = SATISFACTION_CONFIG.maxSendsPerRun,
  now = new Date(),
): Promise<SendReport> {
  const campaigns = await dueCampaigns(limit, now);
  const report: SendReport = { examined: campaigns.length, sent: 0, cancelled: 0, failed: 0 };

  for (const campaign of campaigns) {
    // Le consentement est revérifié au dernier moment : entre l'ouverture de la
    // campagne et son envoi il s'est écoulé vingt-quatre heures, largement de
    // quoi se désabonner.
    const allowed = await isEmailAllowed(campaign.userId, "personalized").catch(() => true);
    if (!allowed || !campaign.user?.email) {
      await prisma.satisfactionCampaign.update({
        where: { id: campaign.id },
        data: {
          status: "CANCELLED",
          reason: allowed ? "adresse manquante" : "désabonné des emails personnalisés",
        },
      });
      report.cancelled++;
      continue;
    }

    // Réservation avant envoi : deux exécutions concurrentes ne peuvent pas
    // expédier le même email, la seconde ne trouvant plus la campagne en
    // `PENDING`.
    const claimed = await prisma.satisfactionCampaign.updateMany({
      where: { id: campaign.id, status: "PENDING" },
      data: { status: "SCHEDULED", attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue;

    try {
      await sendEmail({
        to: campaign.user.email,
        toName: campaign.user.name,
        subject: satisfactionSubject(),
        html: satisfactionEmail({
          firstName: campaign.user.firstName ?? campaign.user.name?.split(" ")[0] ?? null,
          url: satisfactionUrl(campaign.id, BASE),
          listingCount: campaign.activityCount,
        }),
        adSource: SATISFACTION_EMAIL_TYPE,
        userId: campaign.userId,
      });

      await prisma.satisfactionCampaign.update({
        where: { id: campaign.id },
        data: { status: "SENT", sentAt: new Date(), reason: null },
      });
      report.sent++;
    } catch (err) {
      const attempts = campaign.attempts + 1;
      const exhausted = attempts >= MAX_ATTEMPTS;

      await prisma.satisfactionCampaign.update({
        where: { id: campaign.id },
        data: {
          // Sous le plafond, la campagne retourne en attente et sera reprise au
          // passage suivant. Au-delà, elle reste en échec : `FAILED` ne compte
          // pas parmi les états ouverts, le compte redevient donc éligible plus
          // tard sans rester bloqué par une campagne morte.
          status: exhausted ? "FAILED" : "PENDING",
          reason: String(err).slice(0, 200),
        },
      });

      if (exhausted) report.failed++;
      console.error("[satisfaction] envoi échoué", campaign.id, err);
    }
  }

  return report;
}

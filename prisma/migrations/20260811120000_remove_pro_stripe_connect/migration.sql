-- Retrait de l'encaissement Stripe Connect côté professionnel.
--
-- Annule `20260811100000_pro_stripe_connect`. Ce dossier-là est conservé :
-- l'historique des migrations doit rester lisible, et Prisma refuse une
-- migration appliquée dont le fichier a disparu.
--
-- Aucune donnée réelle n'est perdue : la fonctionnalité n'a jamais été mise en
-- service (aucun compte connecté, aucun paiement enregistré).

DROP TABLE IF EXISTS "ProBookingPayment";
DROP TABLE IF EXISTS "StripeWebhookEvent";

ALTER TABLE "ProBooking" DROP COLUMN IF EXISTS "paymentStatus";
ALTER TABLE "ProBooking" DROP COLUMN IF EXISTS "paidAt";

DROP INDEX IF EXISTS "ProProfile_stripeAccountId_key";

ALTER TABLE "ProProfile" DROP COLUMN IF EXISTS "stripeAccountId";
ALTER TABLE "ProProfile" DROP COLUMN IF EXISTS "stripeChargesEnabled";
ALTER TABLE "ProProfile" DROP COLUMN IF EXISTS "stripePayoutsEnabled";
ALTER TABLE "ProProfile" DROP COLUMN IF EXISTS "stripeDetailsSubmitted";
ALTER TABLE "ProProfile" DROP COLUMN IF EXISTS "stripeDisabledReason";
ALTER TABLE "ProProfile" DROP COLUMN IF EXISTS "stripeConnectedAt";
ALTER TABLE "ProProfile" DROP COLUMN IF EXISTS "stripeDisconnectedAt";
ALTER TABLE "ProProfile" DROP COLUMN IF EXISTS "stripeUpdatedAt";
ALTER TABLE "ProProfile" DROP COLUMN IF EXISTS "stripePayoutIssue";
ALTER TABLE "ProProfile" DROP COLUMN IF EXISTS "stripePayoutIssueAt";
ALTER TABLE "ProProfile" DROP COLUMN IF EXISTS "onlinePaymentRequired";

/**
 * Création et remise d'accès annonceur, côté équipe Deal&Co.
 *
 * Regroupé ici plutôt que dans la route : la création se fait depuis l'API
 * admin aujourd'hui, depuis le pipeline commercial (`AdvertiserLead` gagné)
 * demain. Deux appelants, une seule règle.
 */
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { advertiserAccessEmail } from "@/lib/emails/advertiser-access";
import { generateAdvertiserPassword, reserveLoginId } from "./advertiser-auth";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function advertiserLoginUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}/annonceur/connexion`;
}

/** Nom affiché de l'annonceur : l'enseigne quand elle existe, sinon la personne. */
export function advertiserDisplayName(a: {
  company: string | null;
  firstName: string;
  lastName: string;
}): string {
  return a.company?.trim() || `${a.firstName} ${a.lastName}`.trim();
}

export class AdvertiserError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AdvertiserError";
  }
}

export type NewAdvertiserInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  siret?: string | null;
  addressLine?: string | null;
  city?: string | null;
  postalCode?: string | null;
  leadId?: string | null;
};

/**
 * Crée le compte et envoie ses accès.
 *
 * Le mot de passe n'est **jamais** stocké en clair, et n'est renvoyé qu'à
 * l'appelant immédiat pour affichage unique. Perdu, il se régénère ; il ne se
 * relit pas.
 *
 * L'échec de l'e-mail ne fait pas échouer la création : le compte existe, les
 * accès restent affichables à l'écran, et l'admin peut les renvoyer.
 */
export async function createAdvertiser(input: NewAdvertiserInput) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim().toLowerCase();

  if (firstName.length < 2) throw new AdvertiserError("Prénom requis.", 400);
  // Une initiale suffit : « Yaron K. » est une façon normale de se présenter,
  // et ce champ sert à savoir qui appeler, pas à tenir un état civil.
  if (lastName.length < 1) throw new AdvertiserError("Nom requis.", 400);
  if (!EMAIL_RE.test(email)) throw new AdvertiserError("Adresse e-mail invalide.", 400);

  const existing = await prisma.advertiser.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new AdvertiserError("Un annonceur utilise déjà cette adresse.", 409);

  const company = input.company?.trim() || null;
  const loginId = await reserveLoginId(company || firstName);
  if (!loginId) throw new AdvertiserError("Génération de l'identifiant impossible, réessayez.", 500);

  const password = generateAdvertiserPassword();

  const advertiser = await prisma.advertiser.create({
    data: {
      firstName: firstName.slice(0, 80),
      lastName: lastName.slice(0, 80),
      email,
      // Tout le reste est facultatif — un artisan qui veut trois bannières n'a
      // pas à sortir son Kbis. Le SIRET ne sert qu'à la facturation société.
      phone: input.phone?.trim() || null,
      company,
      siret: input.siret?.replace(/\s/g, "") || null,
      addressLine: input.addressLine?.trim() || null,
      city: input.city?.trim() || null,
      postalCode: input.postalCode?.trim() || null,
      leadId: input.leadId || null,
      loginId,
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePassword: true,
    },
  });

  const sent = await sendAccessEmail({
    email: advertiser.email,
    firstName: advertiser.firstName,
    loginId,
    password,
  });

  return { advertiser, loginId, password, sent };
}

/**
 * Régénère le mot de passe et renvoie les accès.
 *
 * L'identifiant ne bouge pas : l'annonceur l'a noté, et le renouveler à chaque
 * oubli créerait plus d'appels qu'il n'en éviterait. Le mot de passe précédent
 * cesse de fonctionner immédiatement — c'est le comportement attendu d'un
 * « renvoyer les accès », et l'ancien n'est de toute façon pas relisible.
 */
export async function resendAdvertiserAccess(advertiserId: string) {
  const advertiser = await prisma.advertiser.findUnique({ where: { id: advertiserId } });
  if (!advertiser) throw new AdvertiserError("Annonceur introuvable.", 404);

  const password = generateAdvertiserPassword();
  await prisma.advertiser.update({
    where: { id: advertiser.id },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePassword: true,
      suspendedAt: null,
    },
  });

  const sent = await sendAccessEmail({
    email: advertiser.email,
    firstName: advertiser.firstName,
    loginId: advertiser.loginId,
    password,
  });

  return { loginId: advertiser.loginId, password, sent };
}

async function sendAccessEmail(input: {
  email: string;
  firstName: string;
  loginId: string;
  password: string;
}): Promise<boolean> {
  try {
    await sendEmail({
      to: input.email,
      toName: input.firstName,
      subject: "Votre espace annonceur Deal&Co est disponible",
      html: advertiserAccessEmail({
        firstName: input.firstName,
        loginId: input.loginId,
        password: input.password,
        loginUrl: advertiserLoginUrl(),
      }),
      adSource: "admin-advertiser-access",
    });
    return true;
  } catch (err) {
    console.error("[advertiser] e-mail d'accès non envoyé", err);
    return false;
  }
}

/**
 * Session d'un annonceur Deal&Co Ads.
 *
 * Volontairement séparée de NextAuth, exactement pour la raison qui a fait
 * séparer celle des membres d'équipe : un annonceur n'est pas un `User`. Il ne
 * publie pas d'annonce, n'a pas de messagerie, ne peut pas réserver. Le
 * mélanger à la session des comptes Deal&Co obligerait à écrire « et si c'est
 * un annonceur alors… » partout où une session est lue, et un seul oubli lui
 * ouvrirait la marketplace.
 *
 * Deux natures d'accès, deux cookies, aucune confusion possible.
 *
 * Jeton HMAC signé, même construction que `lib/pro-member-auth.ts` : rien à
 * stocker côté serveur, révocation immédiate par `suspendedAt` sur la ligne.
 */
import { createHmac, timingSafeEqual, randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const SECRET = process.env.AUTH_SECRET;
if (!SECRET) throw new Error("AUTH_SECRET missing");

export const ADVERTISER_COOKIE = "dco_advertiser";

/**
 * 12 h. Un annonceur consulte ses chiffres depuis un poste de bureau qu'il
 * partage parfois ; une session qui survit à la nuit est une session de trop.
 */
const LIFETIME_SECONDS = 12 * 60 * 60;

function sign(payload: string): string {
  return createHmac("sha256", SECRET!).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/** Jeton `<advertiserId>.<exp>.<signature>`. */
export function createAdvertiserToken(advertiserId: string): string {
  const exp = Math.floor(Date.now() / 1000) + LIFETIME_SECONDS;
  const payload = `${Buffer.from(advertiserId).toString("base64url")}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAdvertiserToken(token: string): { advertiserId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [idB64, expStr, sig] = parts;
  if (!safeEqual(sig, sign(`${idB64}.${expStr}`))) return null;
  if (Number(expStr) < Math.floor(Date.now() / 1000)) return null;
  return { advertiserId: Buffer.from(idB64, "base64url").toString("utf8") };
}

export const ADVERTISER_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: LIFETIME_SECONDS,
};

/** Identifiant de l'annonceur porteur du cookie, sans contrôle en base. */
export async function getAdvertiserSession(): Promise<{ advertiserId: string } | null> {
  const jar = await cookies();
  const raw = jar.get(ADVERTISER_COOKIE)?.value;
  return raw ? verifyAdvertiserToken(raw) : null;
}

export type ActiveAdvertiser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
  loginId: string;
  mustChangePassword: boolean;
  balanceCents: number;
};

/**
 * Annonceur connecté, revérifié en base — la seule porte des routes
 * `/annonceur` et `/api/advertiser`.
 *
 * Le jeton vaut douze heures : sans relecture, un accès suspendu à 9 h
 * resterait ouvert jusqu'au soir. Un annonceur suspendu doit perdre son espace
 * immédiatement, campagnes comprises.
 */
export async function requireActiveAdvertiser(): Promise<ActiveAdvertiser | null> {
  const session = await getAdvertiserSession();
  if (!session) return null;

  const advertiser = await prisma.advertiser.findUnique({
    where: { id: session.advertiserId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      company: true,
      loginId: true,
      mustChangePassword: true,
      suspendedAt: true,
      passwordHash: true,
      balanceCents: true,
    },
  });

  // Sans empreinte de mot de passe, l'accès a été révoqué : le compte existe,
  // il ne se connecte plus.
  if (!advertiser || advertiser.suspendedAt || !advertiser.passwordHash) return null;

  return {
    id: advertiser.id,
    firstName: advertiser.firstName,
    lastName: advertiser.lastName,
    email: advertiser.email,
    company: advertiser.company,
    loginId: advertiser.loginId,
    mustChangePassword: advertiser.mustChangePassword,
    balanceCents: advertiser.balanceCents,
  };
}

// ─────────────────────────────────────────────────────────────
// Génération des identifiants
// ─────────────────────────────────────────────────────────────

/**
 * Identifiant lisible : nom commercial + quatre chiffres.
 * « restaurant-le-marais-4821 ».
 *
 * Lisible parce qu'il se dicte au téléphone — c'est ainsi que l'équipe Deal&Co
 * remet un accès. Les quatre chiffres évitent la collision entre deux
 * enseignes homonymes.
 */
export function generateAdvertiserLoginId(name: string): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 28) || "annonceur";
  return `${base}-${randomInt(1000, 10000)}`;
}

/**
 * Mot de passe temporaire prononçable.
 *
 * Ni `l`/`1`, ni `O`/`0` : il est lu à voix haute ou recopié depuis un e-mail,
 * et un caractère ambigu se traduit par un appel au support. Sa sécurité tient
 * au changement obligatoire à la première connexion, pas à sa complexité.
 */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateAdvertiserPassword(length = 12): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(0, ALPHABET.length)];
  return out;
}

/** Identifiant libre encore disponible, ou `null` après plusieurs essais. */
export async function reserveLoginId(name: string): Promise<string | null> {
  for (let i = 0; i < 6; i++) {
    const candidate = generateAdvertiserLoginId(name);
    const taken = await prisma.advertiser.findUnique({
      where: { loginId: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return null;
}

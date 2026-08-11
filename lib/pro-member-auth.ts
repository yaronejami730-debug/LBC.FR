import { createHmac, timingSafeEqual, randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Session d'un membre d'équipe.
 *
 * Volontairement séparée de NextAuth : un membre d'équipe n'est pas un `User`.
 * Le mélanger à la session des comptes Deal&Co obligerait à écrire, partout où
 * l'on vérifie une session, « et si c'est un membre d'équipe alors… » — et un
 * jour quelqu'un oublierait. Deux natures d'accès, deux cookies, aucune
 * confusion possible : un membre ne peut pas publier une annonce, et un compte
 * client ne peut pas ouvrir un planning de salon.
 *
 * Jeton HMAC signé, même construction que `lib/email-token.ts` : rien à stocker
 * côté serveur, révocation par `accessRevokedAt` sur la ligne d'équipe.
 */

const SECRET = process.env.AUTH_SECRET;
if (!SECRET) throw new Error("AUTH_SECRET missing");

export const MEMBER_COOKIE = "dco_member";

/** 12 h : une journée de travail, pas plus. Un poste de salon est partagé. */
const LIFETIME_SECONDS = 12 * 60 * 60;

function sign(payload: string): string {
  return createHmac("sha256", SECRET!).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/** Jeton `<memberId>.<exp>.<signature>`. */
export function createMemberToken(memberId: string): string {
  const exp = Math.floor(Date.now() / 1000) + LIFETIME_SECONDS;
  const payload = `${Buffer.from(memberId).toString("base64url")}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyMemberToken(token: string): { memberId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [idB64, expStr, sig] = parts;
  if (!safeEqual(sig, sign(`${idB64}.${expStr}`))) return null;
  if (Number(expStr) < Math.floor(Date.now() / 1000)) return null;
  return { memberId: Buffer.from(idB64, "base64url").toString("utf8") };
}

/** Identifiant du membre connecté, ou `null`. À combiner avec un contrôle en base. */
export async function getMemberSession(): Promise<{ memberId: string } | null> {
  const jar = await cookies();
  const raw = jar.get(MEMBER_COOKIE)?.value;
  return raw ? verifyMemberToken(raw) : null;
}

export const MEMBER_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: LIFETIME_SECONDS,
};

/**
 * Membre connecté, vérifié en base — la seule porte d'entrée des routes
 * `/equipe`.
 *
 * Le jeton est signé pour douze heures : sans relecture en base, un accès
 * retiré à 9 h resterait valable jusqu'au soir. Un salarié qui part du salon
 * doit perdre le carnet de rendez-vous immédiatement, et un salon suspendu ne
 * doit plus ouvrir à personne — d'où les quatre conditions réunies ici plutôt
 * que recopiées dans chaque route.
 */
export async function requireActiveMember() {
  const session = await getMemberSession();
  if (!session) return null;

  const member = await prisma.proMember.findUnique({
    where: { id: session.memberId },
    select: {
      id: true,
      profileId: true,
      firstName: true,
      lastName: true,
      displayName: true,
      role: true,
      avatar: true,
      color: true,
      isActive: true,
      accessRevokedAt: true,
      mustChangePassword: true,
      profile: {
        select: {
          id: true,
          name: true,
          city: true,
          isPublished: true,
          user: { select: { bannedAt: true, professionalStatus: true } },
        },
      },
    },
  });

  if (
    !member ||
    !member.isActive ||
    member.accessRevokedAt ||
    member.profile.user.bannedAt ||
    member.profile.user.professionalStatus !== "APPROVED"
  ) {
    return null;
  }

  return member;
}

/**
 * Libellé public d'un membre : prénom seul.
 *
 * Un client choisit « Corinne », pas « Corinne Deschamps » — et la fiche est
 * indexée. Le nom de famille n'apparaît qu'en interne, sauf initiale ajoutée à
 * la main par la responsable quand deux prénoms se confondent.
 */
export function memberDisplayName(firstName: string, lastName?: string | null): string {
  const first = firstName.trim();
  const last = (lastName ?? "").trim();
  if (!first) return last.slice(0, 80);
  return (last ? `${first} ${last[0].toUpperCase()}.` : first).slice(0, 80);
}

// ─────────────────────────────────────────────────────────────
// Génération des identifiants
// ─────────────────────────────────────────────────────────────

/**
 * Identifiant lisible : prénom + quatre chiffres. « corinne-4821 ».
 *
 * Lisible parce qu'il se dicte à l'oral et se note sur un post-it derrière le
 * comptoir — c'est ainsi que ça se passe dans un salon. Les quatre chiffres
 * évitent la collision entre deux Nathalie de deux établissements.
 */
export function generateLoginId(displayName: string): string {
  const base =
    displayName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 20) || "membre";
  return `${base}-${randomInt(1000, 10000)}`;
}

/**
 * Mot de passe temporaire prononçable.
 *
 * Ni `l`/`1`, ni `O`/`0` : la responsable le lit à voix haute ou le recopie, et
 * un caractère ambigu se traduit par un appel au support. La sécurité vient de
 * l'obligation de le changer à la première connexion, pas de sa complexité.
 */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateTempPassword(length = 10): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(0, ALPHABET.length)];
  return out;
}

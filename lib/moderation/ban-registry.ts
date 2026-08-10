/**
 * Registre anti-réinscription.
 *
 * Bannir un compte puis en effacer les données pose une contradiction : si tout
 * disparaît, plus rien n'empêche la même personne de recréer un compte le
 * lendemain. Le registre résout ça en ne gardant *que* des empreintes — des
 * hachages non réversibles calculés après normalisation. On peut reconnaître
 * une réinscription sans conserver la moindre donnée personnelle lisible.
 *
 * 
 * Bloquer sur l'email seul ne sert à rien : une adresse jetable se crée en


* trente secondes. Les signaux **bloquants** sont donc ceux qui coûtent
 * réellement à renouveler et qui appartiennent à la personne : email, numéro
 * de téléphone, empreinte d'appareil.
 *
 * **Le SIRET n'est pas bloquant, et ne doit jamais le devenir.** Un SIRET est
 * un identifiant public : n'importe qui peut recopier celui d'Apple ou de Sony
 * dans un formulaire. Bannir le fraudeur qui l'a usurpé puis interdire ce SIRET
 * reviendrait à punir l'entreprise réelle — la seule qui pourra un jour prouver
 * qu'il est le sien, pièces à l'appui. Le SIRET est donc conservé comme
 * *signal d'usurpation* : une nouvelle demande portant ce numéro est acceptée,
 * mais signalée au modérateur, qui tranchera sur les justificatifs.
 *
 * Le poivre (`BAN_REGISTRY_PEPPER`) empêche qu'une liste d'emails connus soit
 * testée hors ligne contre le registre. Sans lui, on retombe sur un simple
 * sha256(email), qui se casse par force brute sur un dictionnaire d'adresses.
 */

import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/moderation/phone";

const PEPPER = process.env.BAN_REGISTRY_PEPPER ?? process.env.NEXTAUTH_SECRET ?? "";

function digest(kind: string, value: string): string {
  return createHash("sha256").update(`${PEPPER}:${kind}:${value}`).digest("hex");
}

/**
 * Normalise une adresse email avant hachage.
 *
 * Les alias `+quelquechose` et, chez les fournisseurs qui les ignorent, les
 * points dans la partie locale, désignent la même boîte : sans cette
 * normalisation, `jean+1@gmail.com` contournerait le registre.
 */
export function normalizeEmail(raw: string): string | null {
  const email = (raw ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  const [localRaw, domain] = email.split("@");
  if (!localRaw || !domain) return null;

  let local = localRaw.split("+")[0];
  const DOT_INSENSITIVE = new Set(["gmail.com", "googlemail.com"]);
  if (DOT_INSENSITIVE.has(domain)) local = local.replace(/\./g, "");
  if (!local) return null;

  return `${local}@${domain}`;
}

export function hashEmail(raw: string): string | null {
  const normalized = normalizeEmail(raw);
  return normalized ? digest("email", normalized) : null;
}

export function hashPhoneForBan(raw: string): string | null {
  const normalized = normalizePhone(raw);
  return normalized ? digest("phone", normalized) : null;
}

export function hashSiret(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digest("siret", digits) : null;
}

export function hashDevice(fingerprint: string): string {
  return digest("device", fingerprint.trim().toLowerCase());
}

export type BanRegistryEntry = {
  email?: string | null;
  phone?: string | null;
  siret?: string | null;
  deviceFingerprints?: string[];
  reason: string;
  bannedAt?: Date;
  purged?: boolean;
};

/**
 * Inscrit un bannissement au registre.
 *
 * L'email sert de clé d'unicité : rebannir la même adresse met à jour la ligne
 * existante plutôt que d'en empiler une deuxième. Les empreintes d'appareil
 * s'accumulent — un fraudeur qui change de machine laisse deux traces, pas une.
 */
export async function registerBan(entry: BanRegistryEntry): Promise<void> {
  const emailHash = entry.email ? hashEmail(entry.email) : null;
  const phoneHash = entry.phone ? hashPhoneForBan(entry.phone) : null;
  const siretHash = entry.siret ? hashSiret(entry.siret) : null;
  const deviceHashes = (entry.deviceFingerprints ?? [])
    .filter(Boolean)
    .map(hashDevice);

  // Sans le moindre identifiant exploitable, la ligne ne bloquerait rien.
  if (!emailHash && !phoneHash && !siretHash && deviceHashes.length === 0) return;

  const bannedAt = entry.bannedAt ?? new Date();
  const purgedAt = entry.purged ? new Date() : null;

  if (emailHash) {
    const existing = await prisma.banRegistry.findUnique({ where: { emailHash } });
    if (existing) {
      const merged = Array.from(
        new Set([...(JSON.parse(existing.deviceHashes || "[]") as string[]), ...deviceHashes]),
      );
      await prisma.banRegistry.update({
        where: { emailHash },
        data: {
          phoneHash: phoneHash ?? existing.phoneHash,
          siretHash: siretHash ?? existing.siretHash,
          deviceHashes: JSON.stringify(merged),
          banReason: entry.reason,
          purgedAt: purgedAt ?? existing.purgedAt,
        },
      });
      return;
    }
  }

  await prisma.banRegistry.create({
    data: {
      emailHash,
      phoneHash,
      siretHash,
      deviceHashes: JSON.stringify(deviceHashes),
      banReason: entry.reason,
      bannedAt,
      purgedAt,
    },
  });
}

export type BanCheckInput = {
  email?: string | null;
  phone?: string | null;
  deviceFingerprint?: string | null;
};

export type BanCheckResult = {
  blocked: boolean;
  /** Signal ayant déclenché le blocage — pour le journal serveur uniquement. */
  matchedOn: "email" | "phone" | "device" | null;
};

/**
 * Vérifie une inscription contre le registre.
 *
 * Ne regarde que les identifiants personnels. Le SIRET en est délibérément
 * absent : voir `siretFlaggedByBan` pour ce qu'on en fait à la place.
 *
 * Le motif du blocage n'est jamais renvoyé à l'utilisateur : lui dire « votre
 * numéro est banni » lui apprend exactement quoi changer. L'appelant affiche un
 * message générique et journalise `matchedOn` côté serveur.
 */
export async function checkBanRegistry(input: BanCheckInput): Promise<BanCheckResult> {
  const emailHash = input.email ? hashEmail(input.email) : null;
  const phoneHash = input.phone ? hashPhoneForBan(input.phone) : null;

  const or: Array<Record<string, unknown>> = [];
  if (emailHash) or.push({ emailHash });
  if (phoneHash) or.push({ phoneHash });
  if (or.length === 0) return { blocked: false, matchedOn: null };

  const hit = await prisma.banRegistry.findFirst({
    where: { OR: or },
    select: { emailHash: true, phoneHash: true },
  });
  if (!hit) return { blocked: false, matchedOn: null };

  const matchedOn =
    emailHash && hit.emailHash === emailHash
      ? "email"
      : phoneHash && hit.phoneHash === phoneHash
        ? "phone"
        : null;

  return { blocked: true, matchedOn };
}

/**
 * Ce SIRET a-t-il déjà servi à un compte banni ?
 *
 * Renvoie un **signal**, jamais un refus. Un SIRET usurpé est justement celui
 * d'une entreprise qui n'a rien fait : elle doit pouvoir ouvrir son compte, et
 * c'est même souhaitable — c'est la seule qui peut produire le Kbis
 * correspondant et couper l'herbe sous le pied de l'usurpateur.
 *
 * L'appelant s'en sert pour orienter la demande vers un examen manuel attentif,
 * pas pour la bloquer.
 */
export async function siretFlaggedByBan(siret: string | null | undefined): Promise<boolean> {
  if (!siret) return false;
  const siretHash = hashSiret(siret);
  if (!siretHash) return false;
  const hit = await prisma.banRegistry.findFirst({
    where: { siretHash },
    select: { id: true },
  });
  return !!hit;
}

/**
 * Libère un SIRET encore détenu par des comptes bannis.
 *
 * `User.siret` est unique : tant qu'un compte banni le porte, l'entreprise
 * réelle se voit répondre « ce SIRET est déjà associé à un compte » et reste
 * dehors — le fraudeur lui aurait confisqué son identité d'entreprise en
 * partant. Un compte banni n'a aucun titre à conserver un identifiant public
 * qu'il n'a pas prouvé sien : on le détache.
 *
 * Ne touche jamais à un compte actif : si le détenteur n'est pas banni, le
 * conflit est réel et l'appelant doit le refuser normalement.
 */
export async function releaseSiretFromBannedAccounts(siret: string): Promise<number> {
  const digits = (siret ?? "").replace(/\s/g, "");
  if (!digits) return 0;

  const holders = await prisma.user.findMany({
    where: { siret: digits, bannedAt: { not: null } },
    select: { id: true },
  });
  if (holders.length === 0) return 0;

  await prisma.user.updateMany({
    where: { id: { in: holders.map((h) => h.id) } },
    data: { siret: null },
  });

  for (const h of holders) {
    await prisma.moderationEvent
      .create({
        data: {
          userId: h.id,
          actor: "system",
          action: "siret_released",
          reason: "SIRET détaché d'un compte banni : identifiant public réclamé par un autre compte",
        },
      })
      .catch(() => { });
  }

  return holders.length;
}

/**
 * Vérifie une empreinte d'appareil séparément.
 *
 * Les empreintes sont stockées en tableau JSON — pas indexables directement.
 * L'appel reste rare (inscription uniquement) et le registre est petit, mais on
 * borne quand même la lecture pour ne pas dégrader avec le temps.
 */
export async function checkBannedDevice(fingerprint: string): Promise<boolean> {
  if (!fingerprint) return false;
  const target = hashDevice(fingerprint);
  const rows = await prisma.banRegistry.findMany({
    where: { NOT: { deviceHashes: "[]" } },
    select: { deviceHashes: true },
    orderBy: { bannedAt: "desc" },
    take: 2000,
  });
  return rows.some((r) => {
    try {
      return (JSON.parse(r.deviceHashes) as string[]).includes(target);
    } catch {
      return false;
    }
  });
}

/** Message unique renvoyé à toute inscription bloquée. */
export const BAN_BLOCK_MESSAGE = "Impossible de créer un compte avec ces informations.";

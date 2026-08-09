/**
 * Registre anti-réinscription.
 *
 * Bannir un compte puis en effacer les données pose une contradiction : si tout
 * disparaît, plus rien n'empêche la même personne de recréer un compte le
 * lendemain. Le registre résout ça en ne gardant *que* des empreintes — des
 * hachages non réversibles calculés après normalisation. On peut reconnaître
 * une réinscription sans conserver la moindre donnée personnelle lisible.
 *
 * Bloquer sur l'email seul ne sert à rien : une adresse jetable se crée en
 * trente secondes. Les signaux retenus sont ceux qui coûtent réellement à
 * renouveler — numéro de téléphone vérifié, SIRET, empreinte d'appareil —, et
 * ils ne sont utilisés que pour la prévention de la fraude.
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
  siret?: string | null;
  deviceFingerprint?: string | null;
};

export type BanCheckResult = {
  blocked: boolean;
  /** Signal ayant déclenché le blocage — pour le journal serveur uniquement. */
  matchedOn: "email" | "phone" | "siret" | "device" | null;
};

/**
 * Vérifie une inscription contre le registre.
 *
 * Le motif du blocage n'est jamais renvoyé à l'utilisateur : lui dire « votre
 * numéro est banni » lui apprend exactement quoi changer. L'appelant affiche un
 * message générique et journalise `matchedOn` côté serveur.
 */
export async function checkBanRegistry(input: BanCheckInput): Promise<BanCheckResult> {
  const emailHash = input.email ? hashEmail(input.email) : null;
  const phoneHash = input.phone ? hashPhoneForBan(input.phone) : null;
  const siretHash = input.siret ? hashSiret(input.siret) : null;

  const or: Array<Record<string, unknown>> = [];
  if (emailHash) or.push({ emailHash });
  if (phoneHash) or.push({ phoneHash });
  if (siretHash) or.push({ siretHash });
  if (or.length === 0) return { blocked: false, matchedOn: null };

  const hit = await prisma.banRegistry.findFirst({
    where: { OR: or },
    select: { emailHash: true, phoneHash: true, siretHash: true },
  });
  if (!hit) return { blocked: false, matchedOn: null };

  const matchedOn =
    emailHash && hit.emailHash === emailHash
      ? "email"
      : phoneHash && hit.phoneHash === phoneHash
        ? "phone"
        : siretHash && hit.siretHash === siretHash
          ? "siret"
          : null;

  return { blocked: true, matchedOn };
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

/**
 * Résolution du compte professionnel : qui a le droit sur quel établissement,
 * et lequel est actif.
 *
 * Depuis le passage au multi-établissement, `ProProfile.userId` n'est plus
 * unique : un compte peut porter trois salons. Toute la question « de quelle
 * boutique parle-t-on ? » se règle ici, et nulle part ailleurs.
 *
 * Les droits passent par `ProAccess` (le compte qui administre), jamais par
 * `ProMember` (la personne qu'on planifie, souvent sans compte Deal&Co).
 */
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";
import { capabilitiesOf, type Capability } from "./capabilities";
import { lexiconFor } from "./lexicon";
import { builtModulesFor } from "./modules";

/** Cookie qui retient la dernière boutique ouverte. */
export const ACTIVE_ESTABLISHMENT_COOKIE = "activeEstablishment";
/** Paramètre d'URL qui prime sur le cookie — rend les liens partageables. */
export const ACTIVE_ESTABLISHMENT_PARAM = "etab";

export type ProRole = "OWNER" | "ADMIN" | "MANAGER";

export class ProAccessError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ProAccessError";
  }
}

export type Establishment = Awaited<ReturnType<typeof listEstablishments>>[number];

/**
 * Établissements que ce compte peut administrer.
 *
 * Deux sources, réunies : les entreprises où il a un `ProAccess`, et les
 * fiches qu'il a créées lui-même. La seconde est un filet pour les comptes
 * antérieurs à la migration dont le rattachement aurait échoué — sans elle, un
 * professionnel perdrait l'accès à sa propre boutique.
 */
export async function listEstablishments(userId: string) {
  const access = await prisma.proAccess.findMany({ where: { userId } });

  const companyIds = access.map((a) => a.companyId);
  const scoped = access.filter((a) => a.role === "MANAGER").flatMap((a) => parseIds(a.establishmentIds));
  const unscopedCompanies = access.filter((a) => a.role !== "MANAGER").map((a) => a.companyId);

  const establishments = await prisma.proProfile.findMany({
    where: {
      OR: [
        { userId },
        ...(unscopedCompanies.length ? [{ companyId: { in: unscopedCompanies } }] : []),
        ...(scoped.length ? [{ id: { in: scoped } }] : []),
      ],
    },
    orderBy: { createdAt: "asc" },
    include: { company: true },
  });

  // Un MANAGER ne voit que son périmètre, même si sa société en compte dix.
  const managerOnly =
    access.length > 0 && access.every((a) => a.role === "MANAGER") && companyIds.length > 0;
  if (!managerOnly) return establishments;

  const allowed = new Set(scoped);
  return establishments.filter((e) => allowed.has(e.id) || e.userId === userId);
}

/** Rôle du compte sur l'entreprise d'un établissement. `null` s'il n'y en a pas. */
export async function roleFor(userId: string, establishment: { companyId: string | null; userId: string }) {
  if (!establishment.companyId) return establishment.userId === userId ? "OWNER" : null;
  const access = await prisma.proAccess.findUnique({
    where: { userId_companyId: { userId, companyId: establishment.companyId } },
  });
  if (access) return access.role as ProRole;
  // Fiche créée avant la migration, sans ligne d'accès : le créateur reste
  // propriétaire de fait.
  return establishment.userId === userId ? "OWNER" : null;
}

export type ProScope = {
  userId: string;
  role: ProRole;
  establishment: Establishment;
  /** Tous les établissements accessibles — alimente le sélecteur. */
  establishments: Establishment[];
};

/**
 * Établissement actif pour cette requête.
 *
 * Ordre de résolution : `?etab=` dans l'URL, puis le cookie, puis le premier
 * établissement accessible. Un indépendant n'a qu'une boutique et ne voit
 * jamais cette mécanique — c'est l'exigence : la structure multi-sites doit
 * être disponible, pas imposée.
 */
export async function resolveProScope(
  req?: NextRequest,
  explicitId?: string | null,
): Promise<ProScope> {
  const userId = await getAuthUserId(req);
  if (!userId) throw new ProAccessError("Authentification requise.", 401, "UNAUTHORIZED");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPro: true, professionalStatus: true },
  });
  // Verrou inchangé : `isPro` seul ne suffit pas, seul APPROVED ouvre les
  // fonctions professionnelles.
  if (!user?.isPro || user.professionalStatus !== "APPROVED") {
    throw new ProAccessError("Réservé aux comptes professionnels vérifiés.", 403, "NOT_APPROVED_PRO");
  }

  const establishments = await listEstablishments(userId);
  if (establishments.length === 0) {
    throw new ProAccessError("Créez votre fiche établissement d'abord.", 404, "NO_ESTABLISHMENT");
  }

  const requested =
    explicitId ??
    (req ? new URL(req.url).searchParams.get(ACTIVE_ESTABLISHMENT_PARAM) : null) ??
    (await readCookie());

  // Un identifiant hors périmètre est ignoré plutôt que refusé : un cookie
  // périmé ou un lien reçu d'un collègue d'une autre société ne doit pas
  // bloquer l'accès au dashboard.
  const establishment =
    establishments.find((e) => e.id === requested) ?? establishments[0];

  const role = (await roleFor(userId, establishment)) ?? "MANAGER";

  return { userId, role, establishment, establishments };
}

async function readCookie(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(ACTIVE_ESTABLISHMENT_COOKIE)?.value ?? null;
  } catch {
    // `cookies()` n'est pas disponible partout (scripts, contextes statiques).
    return null;
  }
}

/**
 * Contexte complet d'un établissement : ses capacités, son vocabulaire, ses
 * modules. C'est ce que lisent les pages et l'application mobile — aucune
 * n'interprète elle-même le métier.
 */
export async function resolveProContext(req?: NextRequest, explicitId?: string | null) {
  const scope = await resolveProScope(req, explicitId);
  const capabilities = capabilitiesOf(scope.establishment);
  const lexicon = lexiconFor(scope.establishment.activityType);
  return { ...scope, capabilities, lexicon, modules: builtModulesFor(capabilities, lexicon) };
}

/**
 * Refuse l'accès si l'établissement actif n'a pas la capacité demandée.
 *
 * Une ligne en tête de route, et la condition métier n'existe nulle part
 * ailleurs. Un garage qui appellerait l'API des prestations reçoit un 403,
 * même s'il devine l'URL.
 */
export async function requireCapability(req: NextRequest | undefined, capability: Capability) {
  const context = await resolveProContext(req);
  if (!context.capabilities.includes(capability)) {
    throw new ProAccessError(
      "Cette fonctionnalité n'est pas activée pour votre activité.",
      403,
      "CAPABILITY_DISABLED",
    );
  }
  return context;
}

/** Le rôle donne-t-il accès aux données légales et à la facturation ? */
export function canManageCompany(role: ProRole): boolean {
  return role === "OWNER";
}

/** Le rôle permet-il de créer ou supprimer un établissement ? */
export function canManageEstablishments(role: ProRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

function parseIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

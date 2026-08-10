/**
 * Traduction des erreurs métier en réponses HTTP, et garde-fou d'accès pro.
 *
 * Mutualisé pour que les routes web et mobile répondent exactement pareil :
 * une divergence de code de statut entre les deux clients finit toujours par
 * produire deux parcours d'erreur différents.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProAccessError, requireCapability, resolveProContext } from "@/lib/pro/access";
import type { Capability } from "@/lib/pro/capabilities";
import { BookingError } from "./engine";

export function bookingErrorResponse(error: unknown): NextResponse {
  if (error instanceof BookingError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error("[booking] erreur inattendue", error);
  return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
}

/**
 * Fiche professionnelle du compte appelant.
 *
 * Reprend le verrou de `app/api/pro-profile/route.ts` : `isPro` seul ne suffit
 * pas, seul `professionalStatus === "APPROVED"` ouvre les fonctions
 * professionnelles. PENDING, INFO_REQUESTED, REJECTED et SUSPENDED n'ont accès
 * à rien.
 */
export async function requireProProfile(req: NextRequest, capability?: Capability) {
  try {
    // L'établissement actif vient de `?etab=`, du cookie, ou à défaut du
    // premier accessible. Un indépendant n'en a qu'un et ne voit jamais cette
    // résolution ; un groupe de trois salons pilote celui qu'il a ouvert.
    //
    // `capability` est le garde-fou métier, en un seul argument : un garage
    // qui devinerait l'URL des prestations reçoit un 403, sans qu'aucune
    // condition métier ne soit écrite dans la route.
    const context = capability
      ? await requireCapability(req, capability)
      : await resolveProContext(req);
    return { userId: context.userId, profile: context.establishment, context };
  } catch (error) {
    if (error instanceof ProAccessError) {
      throw new BookingError(error.message, error.status, error.code);
    }
    throw error;
  }
}

/**
 * Vérifie que le membre appartient bien à la fiche du pro connecté.
 *
 * Sans ce contrôle, un `memberId` deviné dans une requête permettrait de
 * modifier le planning d'un concurrent : les identifiants sont opaques mais
 * pas secrets.
 */
export async function requireOwnedMember(profileId: string, memberId: string) {
  const member = await prisma.proMember.findUnique({ where: { id: memberId } });
  if (!member || member.profileId !== profileId) {
    throw new BookingError("Membre introuvable.", 404, "MEMBER_NOT_FOUND");
  }
  return member;
}

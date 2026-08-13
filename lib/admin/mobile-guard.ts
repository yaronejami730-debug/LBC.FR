import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-unified";

/**
 * Garde-fou des routes d'administration ouvertes à l'application mobile.
 *
 * L'administration du site passe par des Server Actions, inaccessibles depuis
 * une application native. Ces routes REST existent donc en parallèle, avec le
 * même verrou : rôle ADMIN, vérifié à chaque appel et jamais déduit d'un
 * réglage local. Un téléphone qui prétend être « en mode administrateur » sans
 * l'être reçoit un 403 — le mode n'est qu'un affichage.
 */
export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type AdminActor = { id: string; email: string };

export async function requireMobileAdmin(req: NextRequest): Promise<AdminActor> {
  const user = await getAuthUser(req);
  if (!user) throw new AdminApiError("Authentification requise.", 401);
  if (user.role !== "ADMIN") throw new AdminApiError("Réservé aux administrateurs.", 403);
  return { id: user.id, email: user.email };
}

export function adminErrorResponse(error: unknown) {
  if (error instanceof AdminApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[api/mobile/admin]", error);
  return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
}

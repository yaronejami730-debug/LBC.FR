/**
 * Ingestion d'annonces externes — POST /api/external/listings
 *
 * Auth : `Authorization: Bearer <clé API>` (modèle `ApiKey`).
 * Idempotence : (userId, externalId).
 * Pipeline modération complet — voir `lib/external-create.ts`.
 *
 * Exemple :
 *   curl -X POST https://www.dealandcompany.fr/api/external/listings \
 *     -H "Authorization: Bearer dco_xxx_xxx" \
 *     -H "Content-Type: application/json" \
 *     -d '{"externalId":"src-12345","title":"...","description":"...","price":800,"category":"Loisirs","location":"Lyon"}'
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiKey } from "@/lib/api-key-auth";
import { createExternalListing, type CreateExternalPayload } from "@/lib/external-create";

export async function POST(req: NextRequest) {
  const auth = await verifyApiKey(req);
  if (!auth) {
    return NextResponse.json({ error: "Clé API invalide ou révoquée" }, { status: 401 });
  }

  let body: CreateExternalPayload;
  try {
    body = (await req.json()) as CreateExternalPayload;
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const result = await createExternalListing(
    prisma,
    auth.userId,
    body,
    `apikey:${auth.keyId.slice(0, 8)}`,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.httpStatus });
  }
  if (result.deduplicated) {
    return NextResponse.json(
      { ok: true, deduplicated: true, listingId: result.listingId, status: result.status },
      { status: 200 },
    );
  }
  return NextResponse.json(
    {
      ok: true,
      listingId: result.listingId,
      status: result.status,
      riskScore: result.riskScore,
      decision: result.decision,
    },
    { status: 201 },
  );
}

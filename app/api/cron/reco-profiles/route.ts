/**
 * Reconstruction périodique des profils du moteur de recommandation.
 *
 * Tourne avant la campagne d'envoi : un profil calculé après coup ne sert à
 * rien. Le lot est volontairement modeste — mieux vaut rafraîchir 500 comptes
 * chaque nuit sans jamais dépasser le temps imparti que d'en tenter 40 000 et
 * de se faire couper au milieu.
 */

import { NextResponse } from "next/server";
import { refreshProfiles } from "@/lib/recommendations/refresh";
import { resolvePendingListingGeo } from "@/lib/recommendations/listing-geo";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expected = process.env.CRON_SECRET;
  if (!expected || (secret !== expected && bearer !== expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = Math.min(2000, Number(url.searchParams.get("limit") ?? 500) || 500);

  // Le géocodage passe en premier : les zones d'un compte se déduisent de la
  // localisation de ses annonces et de celles qu'il consulte.
  const geo = await resolvePendingListingGeo({ batchSize: 500, maxBatches: 10 });
  const profiles = await refreshProfiles({ limit });

  return NextResponse.json({ geo, profiles });
}

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth-unified";
import { prisma } from "@/lib/prisma";
import { postingCapabilities } from "@/lib/listing-location";

/**
 * Sous quelles casquettes ce compte peut-il publier ?
 *
 * Le formulaire s'en sert pour n'afficher le choix « particulier ou
 * professionnel » qu'aux comptes qui ont réellement les deux usages. La
 * réponse ne fait pas autorité : `POST /api/listings` refait le calcul et
 * ignore ce que le client prétend.
 */
export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isPro: true,
      professionalStatus: true,
      companyName: true,
      proVerifications: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: { requestType: true },
      },
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const caps = postingCapabilities({
    isPro: user.isPro,
    professionalStatus: user.professionalStatus,
    proRequestType: user.proVerifications[0]?.requestType ?? null,
  });

  return NextResponse.json({ ...caps, companyName: user.companyName ?? null });
}

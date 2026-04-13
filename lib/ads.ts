import { prisma } from "@/lib/prisma";

type AdRow = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  destinationUrl: string;
};

// Retourne les pubs actives en tenant compte de la programmation :
// - isActive = true
// - scheduledAt est null OU dans le passé
// - expiresAt est null OU dans le futur
export async function getActiveAds(take = 100): Promise<AdRow[]> {
  const now = new Date();
  const rows = await prisma.$queryRaw<AdRow[]>`
    SELECT id, title, description, "imageUrl", "destinationUrl"
    FROM "Advertisement"
    WHERE "isActive" = true
      AND ("scheduledAt" IS NULL OR "scheduledAt" <= ${now})
      AND ("expiresAt"   IS NULL OR "expiresAt"   >  ${now})
    ORDER BY "createdAt" DESC
    LIMIT ${take}
  `;
  return rows;
}

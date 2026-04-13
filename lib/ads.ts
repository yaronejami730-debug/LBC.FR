import { prisma } from "@/lib/prisma";

export type AdRow = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  destinationUrl: string;
  isActive: boolean;
  scheduledAt: Date | null;
  expiresAt: Date | null;
};

// Retourne toutes les pubs potentiellement visibles (actives + programmées) pour
// que le client puisse filtrer en temps réel selon l'heure courante.
// Exclut uniquement les pubs déjà expirées.
export async function getActiveAds(take = 100): Promise<AdRow[]> {
  const now = new Date();
  const rows = await prisma.$queryRaw<AdRow[]>`
    SELECT id, title, description, "imageUrl", "destinationUrl",
           "isActive", "scheduledAt", "expiresAt"
    FROM "Advertisement"
    WHERE ("isActive" = true OR "scheduledAt" IS NOT NULL)
      AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
    ORDER BY "createdAt" DESC
    LIMIT ${take}
  `;
  return rows;
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Cron job — tourne toutes les minutes
// Vérifie les scheduledAt (activation) et expiresAt (désactivation)
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Activer les pubs dont la date d'activation est passée
  const activated = await prisma.$executeRaw`
    UPDATE "Advertisement"
    SET "isActive" = true
    WHERE "scheduledAt" IS NOT NULL
      AND "scheduledAt" <= ${now}
      AND "isActive" = false
      AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
  `;

  // Désactiver les pubs dont la date d'expiration est passée
  const deactivated = await prisma.$executeRaw`
    UPDATE "Advertisement"
    SET "isActive" = false
    WHERE "expiresAt" IS NOT NULL
      AND "expiresAt" <= ${now}
      AND "isActive" = true
  `;

  return NextResponse.json({ activated, deactivated, checkedAt: now });
}

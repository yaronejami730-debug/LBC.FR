import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** GET — retourne la clé active (prefix + métadonnées) de l'utilisateur */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const key = await prisma.apiKey.findFirst({
    where: { userId: session.user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, keyPrefix: true, createdAt: true, lastUsedAt: true },
  });

  return NextResponse.json({ key });
}

/** POST — génère une nouvelle clé API (révoque l'ancienne si elle existe) */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { name } = await req.json().catch(() => ({ name: "Clé API" }));

  // Révoquer les anciennes clés
  await prisma.apiKey.updateMany({
    where: { userId: session.user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  // Générer la nouvelle clé : dc_live_ + 32 hex chars
  const rawKey = `dc_live_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 15); // "dc_live_XXXXXXX"

  await prisma.apiKey.create({
    data: {
      userId: session.user.id,
      name: (name as string)?.trim() || "Clé API",
      keyHash,
      keyPrefix,
    },
  });

  // La clé brute n'est retournée qu'une seule fois
  return NextResponse.json({ key: rawKey });
}

/** DELETE — révoque la clé active */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  await prisma.apiKey.updateMany({
    where: { userId: session.user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

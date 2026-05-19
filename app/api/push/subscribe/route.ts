/**
 * Enregistre / met à jour la souscription Web Push d'un appareil.
 * Idempotent : la même `endpoint` reprend du service (réactive si désactivée).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const authKey = typeof body?.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: session.user.id as string,
      endpoint,
      p256dh,
      auth: authKey,
      userAgent,
    },
    update: {
      userId: session.user.id as string,
      p256dh,
      auth: authKey,
      userAgent,
      disabledAt: null,
      lastUsedAt: new Date(),
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : null;
  if (!endpoint) return NextResponse.json({ ok: true });
  await prisma.pushSubscription.deleteMany({
    where: { userId: session.user.id as string, endpoint },
  });
  return NextResponse.json({ ok: true });
}

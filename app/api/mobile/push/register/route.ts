import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const platform = typeof body.platform === "string" ? body.platform : null;
  const deviceName = typeof body.deviceName === "string" ? body.deviceName : null;
  const appVersion = typeof body.appVersion === "string" ? body.appVersion : null;

  if (!token || !token.startsWith("ExponentPushToken")) {
    return NextResponse.json({ error: "Token Expo invalide" }, { status: 400 });
  }

  await prisma.expoPushToken.upsert({
    where: { token },
    create: { userId, token, platform, deviceName, appVersion },
    update: {
      userId,
      platform,
      deviceName,
      appVersion,
      disabledAt: null,
      lastUsedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  if (!token) return NextResponse.json({ ok: true });

  await prisma.expoPushToken.deleteMany({ where: { userId, token } });
  return NextResponse.json({ ok: true });
}

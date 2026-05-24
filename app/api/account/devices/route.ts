import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";

export type DeviceItem = {
  id: string;
  kind: "mobile" | "web";
  platform: string | null;
  deviceName: string | null;
  appVersion: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const [pushTokens, sessions] = await Promise.all([
    prisma.expoPushToken.findMany({
      where: { userId, disabledAt: null },
      orderBy: { lastUsedAt: "desc" },
      take: 20,
      select: { id: true, platform: true, deviceName: true, appVersion: true, createdAt: true, lastUsedAt: true },
    }),
    prisma.deviceSession.findMany({
      where: { userId },
      orderBy: { lastSeenAt: "desc" },
      take: 20,
      select: { id: true, firstSeenAt: true, lastSeenAt: true },
    }),
  ]);

  const mobile: DeviceItem[] = pushTokens.map((t) => ({
    id: t.id,
    kind: "mobile",
    platform: t.platform,
    deviceName: t.deviceName,
    appVersion: t.appVersion,
    firstSeenAt: t.createdAt.toISOString(),
    lastSeenAt: t.lastUsedAt.toISOString(),
  }));

  const web: DeviceItem[] = sessions.map((s) => ({
    id: s.id,
    kind: "web",
    platform: "web",
    deviceName: null,
    appVersion: null,
    firstSeenAt: s.firstSeenAt.toISOString(),
    lastSeenAt: s.lastSeenAt.toISOString(),
  }));

  const all = [...mobile, ...web].sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  return NextResponse.json(all);
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id, kind } = await req.json().catch(() => ({}));
  if (!id || (kind !== "mobile" && kind !== "web")) {
    return NextResponse.json({ error: "id et kind requis" }, { status: 400 });
  }

  if (kind === "mobile") {
    await prisma.expoPushToken.updateMany({
      where: { id, userId },
      data: { disabledAt: new Date() },
    });
  } else {
    await prisma.deviceSession.deleteMany({ where: { id, userId } });
  }

  return NextResponse.json({ ok: true });
}

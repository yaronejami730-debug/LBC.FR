import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function checkAdmin() {
  const session = await auth();
  const role = (session?.user as Record<string, unknown> | undefined)?.role;
  return role === "ADMIN";
}

export async function POST(req: NextRequest) {
  if (!await checkAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const banner = await prisma.heroBanner.create({
    data: {
      title: body.title,
      subtitle: body.subtitle || null,
      bgFrom: body.bgFrom || "#2f6fb8",
      bgTo: body.bgTo || "#1a5a9e",
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
    },
  });
  return NextResponse.json(banner, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!await checkAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, isActive } = await req.json();
  // Si on active, désactiver les autres d'abord
  if (isActive) await prisma.heroBanner.updateMany({ data: { isActive: false } });
  const banner = await prisma.heroBanner.update({ where: { id }, data: { isActive } });
  return NextResponse.json(banner);
}

export async function DELETE(req: NextRequest) {
  if (!await checkAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await req.json();
  await prisma.heroBanner.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

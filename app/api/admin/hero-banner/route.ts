import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-unified";

/**
 * Verrou administrateur — session du site ou jeton Bearer de l'application.
 *
 * Le rôle est relu en base à chaque appel : c'est la seule autorité, un jeton
 * ne prouve pas que le compte est encore administrateur aujourd'hui.
 */
async function checkAdmin(req: NextRequest) {
  const actor = await getAuthUser(req);
  if (!actor?.id) return false;
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { role: true },
  });
  return user?.role === "ADMIN";
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const banner = await prisma.heroBanner.create({
    data: {
      title: body.title,
      subtitle: body.subtitle || null,
      bgFrom: body.bgFrom || "#2f6fb8",
      bgTo: body.bgTo || "#1a5a9e",
      bgImage: body.bgImage || null,
      showText: typeof body.showText === "boolean" ? body.showText : true,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
    },
  });
  return NextResponse.json(banner, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!(await checkAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id, isActive } = await req.json();
  // Si on active, désactiver les autres d'abord
  if (isActive) await prisma.heroBanner.updateMany({ data: { isActive: false } });
  const banner = await prisma.heroBanner.update({ where: { id }, data: { isActive } });
  return NextResponse.json(banner);
}

export async function DELETE(req: NextRequest) {
  if (!(await checkAdmin(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await req.json();
  await prisma.heroBanner.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { password } = await req.json().catch(() => ({}));

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, password: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  }

  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Mot de passe requis pour confirmer la suppression" }, { status: 400 });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 403 });
  }

  // Hard delete — cascade supprime listings, messages, favoris, etc.
  await prisma.user.delete({ where: { id: user.id } });

  return NextResponse.json({ success: true }, { status: 200 });
}

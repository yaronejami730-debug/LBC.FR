import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { avatar } = await req.json();
  if (!avatar || typeof avatar !== "string") {
    return NextResponse.json({ error: "URL avatar invalide" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { avatar },
    select: { id: true, avatar: true },
  });

  return NextResponse.json(user);
}

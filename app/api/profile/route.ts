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


  // Autoriser seulement les URLs de nos sources de confiance
  let parsedAvatar: URL;
  try {
    parsedAvatar = new URL(avatar);
  } catch {
    return NextResponse.json({ error: "URL avatar invalide" }, { status: 400 });
  }

  const ALLOWED_AVATAR_HOSTS = [
    /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/,
    /^lh3\.googleusercontent\.com$/,
  ];
  const isAllowed =
    parsedAvatar.protocol === "https:" &&
    ALLOWED_AVATAR_HOSTS.some((p) => p.test(parsedAvatar.hostname));

  if (!isAllowed) {
    return NextResponse.json({ error: "Source d'avatar non autorisée" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { avatar },
    select: { id: true, avatar: true },
  });

  return NextResponse.json(user);
}

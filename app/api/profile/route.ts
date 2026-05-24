import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";

export async function PATCH(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const session = { user: { id: userId } } as { user: { id: string } };

  const body = await req.json();

  // marketingConsent toggle
  if (typeof body.marketingConsent === "boolean") {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { marketingConsent: body.marketingConsent },
      select: { id: true, marketingConsent: true },
    });
    return NextResponse.json(user);
  }

  // Informations personnelles : nom, raison sociale, téléphone.
  if (
    typeof body.name === "string" ||
    typeof body.companyName === "string" ||
    typeof body.phoneNumber === "string"
  ) {
    const data: { name?: string; companyName?: string | null; phoneNumber?: string | null } = {};

    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (name.length < 2 || name.length > 80) {
        return NextResponse.json({ error: "Nom invalide (2 à 80 caractères)" }, { status: 400 });
      }
      data.name = name;
    }

    if (typeof body.companyName === "string") {
      const cn = body.companyName.trim();
      data.companyName = cn || null;
    }

    if (typeof body.phoneNumber === "string") {
      const raw = body.phoneNumber.replace(/[\s.]/g, "");
      if (raw === "") {
        data.phoneNumber = null;
      } else if (!/^(\+?\d{6,15})$/.test(raw)) {
        return NextResponse.json({ error: "Numéro de téléphone invalide" }, { status: 400 });
      } else {
        data.phoneNumber = raw;
      }
    }

    try {
      const user = await prisma.user.update({
        where: { id: session.user.id },
        data,
        select: { id: true, name: true, companyName: true, phoneNumber: true },
      });
      return NextResponse.json(user);
    } catch (e) {
      if (e && typeof e === "object" && (e as { code?: string }).code === "P2002") {
        return NextResponse.json({ error: "Ce numéro est déjà utilisé par un autre compte." }, { status: 409 });
      }
      throw e;
    }
  }

  const { avatar } = body;
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

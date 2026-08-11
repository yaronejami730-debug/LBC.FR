import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { requireActiveMember } from "@/lib/pro-member-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Photo de profil d'un membre d'équipe, posée par lui-même.
 *
 * `/api/upload` ne convient pas ici : il exige une session `User`, et un membre
 * d'équipe n'en est pas un. Lui en ouvrir une pour une photo reviendrait à
 * mélanger deux natures d'accès que tout le reste du code sépare — un membre
 * ne publie pas d'annonces.
 *
 * La responsable garde la même possibilité depuis `Équipe et horaires` : les
 * deux écrivent la même colonne. C'est voulu, et c'est le fonctionnement réel
 * d'un salon — la patronne prend la photo le premier jour, la personne la
 * remplace quand elle le souhaite.
 */

/** Une pastille d'agenda et une vignette de fiche : 512 px suffisent. */
const SIZE = 512;
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const member = await requireActiveMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Seules les images sont acceptées" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Photo trop lourde (max 8 Mo)" }, { status: 400 });
    }

    // Recadrage carré côté serveur : la pastille de l'agenda est ronde, une
    // photo verticale envoyée depuis un téléphone y apparaîtrait décapitée.
    const buffer = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize(SIZE, SIZE, { fit: "cover", position: "attention" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    let url: string;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`equipe/${filename}`, buffer, {
        access: "public",
        contentType: "image/jpeg",
      });
      url = blob.url;
    } else {
      const dir = path.join(process.cwd(), "public", "uploads");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, filename), buffer);
      url = `/uploads/${filename}`;
    }

    await prisma.proMember.update({ where: { id: member.id }, data: { avatar: url } });
    return NextResponse.json({ avatar: url });
  } catch (error) {
    console.error("[equipe/photo]", error);
    return NextResponse.json({ error: "Envoi impossible, réessayez" }, { status: 500 });
  }
}

/** Retrait de sa propre photo. */
export async function DELETE() {
  const member = await requireActiveMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.proMember.update({ where: { id: member.id }, data: { avatar: null } });
  return NextResponse.json({ avatar: null });
}

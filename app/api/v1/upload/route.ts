import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import crypto from "crypto";

function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function resolveApiKey(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!raw || !raw.startsWith("dc_live_")) return null;
  const record = await prisma.apiKey.findUnique({
    where: { keyHash: hashKey(raw) },
    select: { id: true, revokedAt: true, userId: true },
  });
  if (!record || record.revokedAt) return null;
  prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return record;
}

/**
 * POST /api/v1/upload
 * Authentification : Authorization: Bearer dc_live_xxxx
 * Body : multipart/form-data avec le champ "file"
 * Retourne : { url: "https://..." }
 *
 * Upload jusqu'à 10 Mo. Types acceptés : image/jpeg, image/png, image/webp, image/gif.
 */
export async function POST(req: NextRequest) {
  const key = await resolveApiKey(req);
  if (!key) {
    return NextResponse.json(
      { error: "Clé API invalide. Header requis : Authorization: Bearer dc_live_xxxx" },
      { status: 401 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Corps multipart/form-data attendu" }, { status: 400 });
  }

  const file = form.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Champ 'file' manquant dans le form-data" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Image trop lourde (max 10 Mo)" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Seuls les fichiers images sont acceptés" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filename = `api-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const blob = await put(`uploads/${filename}`, file, { access: "public" });

  return NextResponse.json({ url: blob.url });
}

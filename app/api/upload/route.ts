import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { put } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Vous devez être connecté" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "L'image est trop lourde (max 10Mo)" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Seuls les fichiers images sont autorisés" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // En production (Vercel) → Vercel Blob
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`uploads/${filename}`, file, { access: "public" });
      console.log(`[UPLOAD] Blob: ${blob.url}`);
      return NextResponse.json({ url: blob.url });
    }

    // En développement local → filesystem
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    const bytes = await file.arrayBuffer();
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), Buffer.from(bytes));
    console.log(`[UPLOAD] Local: /uploads/${filename}`);
    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (err) {
    console.error("[UPLOAD ERROR]", err);
    const message = err instanceof Error ? err.message : "Erreur lors de l'enregistrement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// NOTE: This local filesystem approach works for development only.
// For production on Vercel, replace with Vercel Blob:
//   import { put } from "@vercel/blob";
//   const blob = await put(filename, file, { access: "public" });
//   return NextResponse.json({ url: blob.url });

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

    // Basic size check (Next.js default is usually ~4MB or more, but we can check here)
    if (file.size > 10 * 1024 * 1024) { // 10MB
      return NextResponse.json({ error: "L'image est trop lourde (max 10Mo)" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Seuls les fichiers images sont autorisés" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");

    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);

    console.log(`[UPLOAD] Succès: /uploads/${filename} (${file.size} bytes)`);
    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (err) {
    console.error("[UPLOAD ERROR]", err);
    const message = err instanceof Error ? err.message : "Erreur lors de l'enregistrement du fichier";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

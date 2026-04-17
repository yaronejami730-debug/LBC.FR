import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { put } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const PLATE_SERVICE = process.env.PLATE_BLUR_SERVICE_URL ?? "http://localhost:8001";

interface BlurResult {
  blob: Blob;
  platesFound: number;
}

/** Call plate-blur microservice. Returns blurred blob + plate count, or null if unavailable. */
async function tryBlurPlates(file: File): Promise<BlurResult | null> {
  try {
    const form = new FormData();
    form.append("file", file, file.name);
    const res = await fetch(`${PLATE_SERVICE}/blur`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const platesFound = parseInt(res.headers.get("X-Plates-Found") ?? "0", 10);
    return { blob: await res.blob(), platesFound };
  } catch {
    return null;
  }
}

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

    // Try to blur license plates — falls back silently if service is offline
    const blurResult = await tryBlurPlates(file);
    const payload: Blob | File = blurResult?.blob ?? file;
    const platesFound = blurResult?.platesFound ?? 0;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`uploads/${filename}`, payload, { access: "public" });
      console.log(`[UPLOAD] Blob: ${blob.url} | plaques floutées: ${platesFound}`);
      return NextResponse.json({ url: blob.url, platesFound });
    }

    // Local dev — filesystem
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    const bytes = await payload.arrayBuffer();
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), Buffer.from(bytes));
    console.log(`[UPLOAD] Local: /uploads/${filename} | plaques floutées: ${platesFound}`);
    return NextResponse.json({ url: `/uploads/${filename}`, platesFound });
  } catch (err) {
    console.error("[UPLOAD ERROR]", err);
    const message = err instanceof Error ? err.message : "Erreur lors de l'enregistrement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

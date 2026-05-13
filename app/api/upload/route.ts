import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { put } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";

export const runtime = "nodejs";
export const maxDuration = 60;

interface PlateBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

async function detectPlates(buffer: Buffer, mimeType: string): Promise<PlateBox[]> {
  const token = process.env.PLATE_RECOGNIZER_TOKEN;
  if (!token) return [];

  try {
    const form = new FormData();
    form.append(
      "upload",
      new Blob([new Uint8Array(buffer)], { type: mimeType }),
      "image.jpg",
    );
    form.append("regions", "fr");

    const res = await fetch("https://api.platerecognizer.com/v1/plate-reader/", {
      method: "POST",
      headers: { Authorization: `Token ${token}` },
      body: form,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.error("[PlateRecognizer]", res.status, await res.text().catch(() => ""));
      return [];
    }

    const data = (await res.json()) as { results?: { box: PlateBox }[] };
    return (data.results ?? []).map((r) => r.box);
  } catch (err) {
    console.error("[PlateRecognizer] exception:", err);
    return [];
  }
}

async function blurPlates(input: Buffer, boxes: PlateBox[]): Promise<Buffer> {
  if (boxes.length === 0) return input;

  const rotated = await sharp(input).rotate().toBuffer();
  const meta = await sharp(rotated).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) return input;

  const overlays: { input: Buffer; left: number; top: number }[] = [];

  for (const box of boxes) {
    const bw = box.xmax - box.xmin;
    const bh = box.ymax - box.ymin;
    const padX = Math.round(bw * 0.30);
    const padY = Math.round(bh * 0.45);
    const left = Math.max(0, Math.round(box.xmin - padX));
    const top = Math.max(0, Math.round(box.ymin - padY));
    const width = Math.min(W - left, Math.round(bw + padX * 2));
    const height = Math.min(H - top, Math.round(bh + padY * 2));
    if (width <= 4 || height <= 4) continue;

    const tinyW = Math.max(3, Math.round(width / 28));
    const tinyH = Math.max(3, Math.round(height / 28));
    const sigma = Math.max(20, Math.min(width, height) / 6);

    // Pass 1 — extreme pixelate (irreversible)
    const pixelated = await sharp(rotated)
      .extract({ left, top, width, height })
      .resize(tinyW, tinyH, { kernel: "nearest" })
      .resize(width, height, { kernel: "nearest" })
      .toBuffer();

    // Pass 2 — heavy gaussian blur on pixelated buffer
    const blurred1 = await sharp(pixelated).blur(sigma).toBuffer();

    // Pass 3 — second blur pass, destroys any residual structure
    const blurred2 = await sharp(blurred1).blur(sigma * 0.7).toBuffer();

    // Pass 4 — darken slightly to crush remaining contrast
    const region = await sharp(blurred2)
      .modulate({ brightness: 0.78, saturation: 0.4 })
      .png()
      .toBuffer();

    overlays.push({ input: region, left, top });
  }

  if (overlays.length === 0) return rotated;

  return sharp(rotated).composite(overlays).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
}

async function compress(buffer: Buffer, mimeType: string): Promise<Buffer> {
  try {
    const img = sharp(buffer).rotate();
    const meta = await img.metadata();
    const maxDim = 2200;
    if ((meta.width ?? 0) > maxDim || (meta.height ?? 0) > maxDim) {
      img.resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true });
    }
    return mimeType === "image/png"
      ? await img.png({ compressionLevel: 9 }).toBuffer()
      : await img.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  } catch {
    return buffer;
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
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "L'image est trop lourde (max 15Mo)" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Seuls les fichiers images sont autorisés" }, { status: 400 });
    }

    const raw = Buffer.from(await file.arrayBuffer());

    const boxes = await detectPlates(raw, file.type);
    const blurred = await blurPlates(raw, boxes);
    const isPng = file.type === "image/png";
    const finalBuf = await compress(blurred, isPng ? "image/png" : "image/jpeg");

    const ext = isPng ? "png" : "jpg";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const contentType = isPng ? "image/png" : "image/jpeg";

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`uploads/${filename}`, finalBuf, {
        access: "public",
        contentType,
      });
      console.log(`[UPLOAD] ${blob.url} plates=${boxes.length}`);
      return NextResponse.json({ url: blob.url, platesFound: boxes.length });
    }

    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), finalBuf);
    console.log(`[UPLOAD] /uploads/${filename} plates=${boxes.length}`);
    return NextResponse.json({ url: `/uploads/${filename}`, platesFound: boxes.length });
  } catch (err) {
    console.error("[UPLOAD ERROR]", err);
    const message = err instanceof Error ? err.message : "Erreur lors de l'enregistrement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

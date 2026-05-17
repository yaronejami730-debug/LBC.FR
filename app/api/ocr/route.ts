/**
 * POST /api/ocr
 *
 * Pipeline OCR sans IA générative :
 *   image → prétraitement sharp → Tesseract (WASM) → extraction références
 *
 * Body    : { imageUrl: string }
 * Réponse : { text, confidence, references }
 *
 * Opération coûteuse (plusieurs secondes) → authentification requise.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { preprocessForOcr } from "@/lib/ocr-preprocess";
import { runOcr } from "@/lib/ocr";
import { extractReferences } from "@/lib/ocr-references";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const imageUrl = typeof (body as { imageUrl?: unknown })?.imageUrl === "string"
    ? (body as { imageUrl: string }).imageUrl
    : "";
  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl requis" }, { status: 400 });
  }

  // Téléchargement de l'image
  let buffer: Buffer;
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      return NextResponse.json({ error: `Image inaccessible (${res.status})` }, { status: 400 });
    }
    if (!(res.headers.get("content-type") ?? "").startsWith("image/")) {
      return NextResponse.json({ error: "L'URL ne pointe pas vers une image" }, { status: 400 });
    }
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image trop lourde (max 12 Mo)" }, { status: 400 });
    }
    buffer = Buffer.from(ab);
  } catch {
    return NextResponse.json({ error: "Téléchargement de l'image échoué" }, { status: 400 });
  }

  // OCR
  try {
    const processed = await preprocessForOcr(buffer);
    const ocr = await runOcr(processed);
    return NextResponse.json({
      text: ocr.text,
      confidence: ocr.confidence,
      references: extractReferences(ocr.text),
    });
  } catch (err) {
    console.error("[POST /api/ocr]", err);
    return NextResponse.json({ error: "Traitement OCR échoué" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";

const HF_MODEL = "keremberke/license-plate-object-detection";
const HF_API   = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

const ALLOWED_IMAGE_HOSTS = [
  /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/,
  /^lh3\.googleusercontent\.com$/,
];

function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_IMAGE_HOSTS.some((pattern) => pattern.test(parsed.hostname));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const { imageUrl } = await req.json();
  if (!imageUrl) return NextResponse.json({ error: "imageUrl required" }, { status: 400 });

  if (!isAllowedImageUrl(imageUrl)) {
    return NextResponse.json({ error: "URL d'image non autorisée" }, { status: 400 });
  }

  // Fetch the image server-side (avoids CORS)
  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(5_000) });
  if (!imgRes.ok) return NextResponse.json({ error: "Cannot fetch image" }, { status: 400 });
  const imageBlob = await imgRes.blob();

  const hfRes = await fetch(HF_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_TOKEN}`,
      "Content-Type": imgRes.headers.get("content-type") || "image/jpeg",
    },
    body: imageBlob,
  });

  if (!hfRes.ok) {
    const text = await hfRes.text();
    return NextResponse.json({ error: text }, { status: hfRes.status });
  }

  // HF returns: [{ score, label, box: { xmin, ymin, xmax, ymax } }, ...]
  // box values are absolute pixels on the original image
  const detections = await hfRes.json();
  return NextResponse.json({ detections });
}

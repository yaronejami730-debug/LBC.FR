import { NextRequest, NextResponse } from "next/server";

const PLATE_SERVICE = process.env.PLATE_BLUR_SERVICE_URL ?? "http://localhost:8001";

const ALLOWED_IMAGE_HOSTS = [
  /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/,
  /^lh3\.googleusercontent\.com$/,
];

function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_IMAGE_HOSTS.some((p) => p.test(parsed.hostname));
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

  const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(5_000) });
  if (!imgRes.ok) return NextResponse.json({ error: "Cannot fetch image" }, { status: 400 });

  const form = new FormData();
  form.append("file", await imgRes.blob(), "image.jpg");

  try {
    const svcRes = await fetch(`${PLATE_SERVICE}/detect`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(10_000),
    });

    if (!svcRes.ok) {
      return NextResponse.json({ detections: [] });
    }

    const data = await svcRes.json();
    return NextResponse.json(data);
  } catch {
    // Graceful degradation — service down, return empty (user can place box manually)
    return NextResponse.json({ detections: [] });
  }
}

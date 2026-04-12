import { NextRequest, NextResponse } from "next/server";

function extractMeta(html: string, property: string): string {
  // Match both property="og:xxx" and name="og:xxx", in any attribute order
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() ?? "";
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  try {
    new URL(url); // validate
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PrèsDeToi/1.0; +https://presdetoi.fr)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 502 });

    const html = await res.text();

    const title       = extractMeta(html, "og:title")       || extractTitle(html);
    const description = extractMeta(html, "og:description") || extractMeta(html, "description");
    const image       = extractMeta(html, "og:image");

    // Resolve relative image URL
    let imageUrl = image;
    if (image && !image.startsWith("http")) {
      const base = new URL(url);
      imageUrl = new URL(image, base.origin).href;
    }

    return NextResponse.json({ title, description, imageUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 502 }
    );
  }
}

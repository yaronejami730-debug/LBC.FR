import { NextRequest, NextResponse } from "next/server";

function extractMeta(html: string, ...properties: string[]): string {
  for (const property of properties) {
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
      new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i"),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]?.trim()) return m[1].trim();
    }
  }
  return "";
}

function extractTitle(html: string): string {
  const og = extractMeta(html, "og:title", "twitter:title");
  if (og) return og;
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() ?? "";
}

function resolveUrl(src: string, base: string): string {
  if (!src) return "";
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  if (src.startsWith("//")) return `https:${src}`;
  try {
    return new URL(src, base).href;
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  try { new URL(url); } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 502 });

    // Only read first 100KB — enough for <head>
    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        html += new TextDecoder().decode(value);
        total += value.length;
        if (total > 100_000) break;
      }
      reader.cancel();
    }

    const title       = extractTitle(html);
    const description = extractMeta(html, "og:description", "twitter:description", "description");
    const imageRaw    = extractMeta(html, "og:image", "og:image:url", "twitter:image", "twitter:image:src");
    const imageUrl    = resolveUrl(imageRaw, url);

    return NextResponse.json({ title, description, imageUrl });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 502 }
    );
  }
}

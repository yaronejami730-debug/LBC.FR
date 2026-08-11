import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

/**
 * Aperçu d'un lien : le serveur va chercher la page et en extrait les balises.
 *
 * C'est un outil d'administration — il ne sert qu'à `components/admin/AdForm`
 * pour pré-remplir une publicité. Il était pourtant ouvert à tous, et il fait
 * exactement ce qu'un SSRF cherche : émettre une requête sortante vers une URL
 * fournie par l'appelant, puis lui renvoyer un extrait de la réponse. Pointé
 * sur une adresse interne, il transformait le serveur en fenêtre sur le réseau
 * privé.
 *
 * Deux verrous : réservé aux administrateurs, et refus des cibles non
 * routables sur Internet.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN") {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (dbUser?.role !== "ADMIN") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  }

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let target: URL;
  try { target = new URL(url); } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (!isPubliclyRoutable(target)) {
    return NextResponse.json({ error: "URL non autorisée" }, { status: 400 });
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

    if (!res.ok) {
      const msg = res.status === 400 || res.status === 403 || res.status === 429
        ? "Ce site bloque le scraping automatique. Remplis le titre, la description et l'image manuellement."
        : `Erreur ${res.status} sur le site distant`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }

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

/**
 * La cible doit être une adresse publique.
 *
 * `localhost`, les plages privées RFC1918, le lien-local et l'IP de métadonnées
 * des fournisseurs cloud (169.254.169.254) sont les cibles classiques d'un
 * SSRF : elles ne sont joignables que depuis le serveur, jamais depuis le
 * navigateur de l'administrateur qui saisit le lien.
 */
function isPubliclyRoutable(url: URL): boolean {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return false;
  if (host === "[::1]" || host === "::1") return false;

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 192 && b === 168) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 169 && b === 254) return false;
    if (a >= 224) return false;
  }
  return true;
}

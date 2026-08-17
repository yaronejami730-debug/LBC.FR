import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-unified";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Relit une pièce jointe de support.
 *
 * Deux personnes seulement peuvent la voir : l'auteur de la discussion et un
 * modérateur. Tout autre cas répond 404 plutôt que 403 — dire « interdit »
 * confirmerait l'existence du fichier.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const actor = await getAuthUser(req);
  if (!actor?.id) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const file = await prisma.supportAttachment.findUnique({
    where: { id },
    select: {
      bytes: true,
      contentType: true,
      fileName: true,
      ticket: { select: { userId: true } },
    },
  });
  if (!file) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const account = await prisma.user.findUnique({ where: { id: actor.id }, select: { role: true } });
  const allowed = file.ticket.userId === actor.id || account?.role === "ADMIN";
  if (!allowed) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const body = Buffer.from(file.bytes);
  const headers: Record<string, string> = {
    "Content-Type": file.contentType,
    // `inline` : une capture d'écran s'ouvre dans l'onglet, elle ne se
    // télécharge pas. Le nom reste celui d'origine pour l'enregistrement.
    "Content-Disposition": `inline; filename="${encodeURIComponent(file.fileName)}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };

  /**
   * Lecture partielle, pour les vidéos.
   *
   * Safari ne lit pas une vidéo servie d'un bloc : il demande un fragment et
   * abandonne si le serveur répond 200. Sans cette branche, une vidéo envoyée
   * au support reste un rectangle noir sur iPhone.
   */
  const range = req.headers.get("range");
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (match) {
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), body.byteLength - 1) : body.byteLength - 1;
    if (start >= body.byteLength || start > end) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${body.byteLength}` },
      });
    }
    const slice = body.subarray(start, end + 1);
    return new NextResponse(slice, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${body.byteLength}`,
        "Content-Length": String(slice.byteLength),
      },
    });
  }

  return new NextResponse(body, { headers });
}

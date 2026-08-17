import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-unified";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
/**
 * Les vidéos ont droit à plus de place — filmer un écran qui bugue vaut dix
 * captures — mais pas illimitée : les octets vivent dans la base, pas dans un
 * store d'objets, et une pièce jointe ne doit pas peser plus qu'un dossier.
 */
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic",
  "video/mp4", "video/quicktime", "video/webm",
  "application/pdf",
]);

/** Types déduits de l'extension : plusieurs sélecteurs mobiles n'annoncent rien. */
const EXT_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  heic: "image/heic", pdf: "application/pdf",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", m4v: "video/mp4",
};

function resolveType(file: File): string {
  if (file.type && ALLOWED.has(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TYPES[ext] ?? file.type ?? "";
}

/**
 * Dépôt d'une pièce jointe de support, par l'utilisateur ou par un modérateur.
 *
 * Le fichier n'est jamais public : il est conservé en base et relu par
 * `/api/support/attachment/[id]`, qui vérifie que le demandeur est partie à la
 * discussion. Une capture envoyée au support contient trop souvent une facture
 * ou une pièce d'identité pour finir derrière une URL ouverte.
 */
export async function POST(req: NextRequest) {
  const actor = await getAuthUser(req);
  if (!actor?.id) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const ticketId = String(form?.get("ticketId") ?? "");

  if (!(file instanceof File)) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "Fichier vide" }, { status: 400 });

  const contentType = resolveType(file);
  if (!ALLOWED.has(contentType)) {
    return NextResponse.json(
      { error: "Formats acceptés : JPEG, PNG, WebP, HEIC, MP4, MOV, WebM ou PDF" },
      { status: 415 },
    );
  }

  const limit = contentType.startsWith("video/") ? MAX_VIDEO_BYTES : MAX_BYTES;
  if (file.size > limit) {
    return NextResponse.json(
      { error: `Fichier trop lourd (${Math.round(limit / 1024 / 1024)} Mo maximum)` },
      { status: 413 },
    );
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, userId: true },
  });
  if (!ticket) return NextResponse.json({ error: "Discussion introuvable" }, { status: 404 });

  const account = await prisma.user.findUnique({ where: { id: actor.id }, select: { role: true } });
  const allowed = ticket.userId === actor.id || account?.role === "ADMIN";
  // Même réponse qu'une discussion inexistante : confirmer l'existence d'un
  // ticket à quelqu'un qui n'y a pas droit est déjà une fuite.
  if (!allowed) return NextResponse.json({ error: "Discussion introuvable" }, { status: 404 });

  const data = Buffer.from(await file.arrayBuffer());
  const saved = await prisma.supportAttachment.create({
    data: {
      ticketId: ticket.id,
      uploaderId: actor.id,
      fileName: file.name.slice(0, 120),
      contentType,
      sizeBytes: data.byteLength,
      bytes: Uint8Array.from(data),
    },
    select: { id: true, fileName: true, contentType: true, sizeBytes: true },
  });

  return NextResponse.json({
    url: `/api/support/attachment/${saved.id}`,
    name: saved.fileName,
    type: saved.contentType,
    size: saved.sizeBytes,
  });
}

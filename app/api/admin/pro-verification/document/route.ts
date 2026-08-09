import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Lecture d'une pièce justificative par un modérateur.
 *
 * Les documents vivent en blob privé : ils n'ont pas d'URL publique et ne
 * peuvent être servis qu'ici, après contrôle du rôle ADMIN. Le chemin demandé
 * doit en plus correspondre à un compte existant — sinon un admin (ou une
 * faille de session) pourrait parcourir tout le store.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const path = req.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "Chemin manquant" }, { status: 400 });
  // Pièce déjà effacée : le chemin ne désigne plus rien.
  if (path.startsWith("deleted:")) {
    return NextResponse.json(
      { error: "Document supprimé conformément à la durée de conservation" },
      { status: 410 },
    );
  }

  const known = await prisma.proVerification.findFirst({
    where: { OR: [{ idDocumentPath: path }, { companyDocPath: path }] },
    select: { id: true },
  });
  if (!known) return NextResponse.json({ error: "Document inconnu" }, { status: 404 });

  try {
    const blob = await get(path, { access: "private" });
    if (!blob || blob.statusCode !== 200) {
      return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
    }

    return new NextResponse(blob.stream, {
      headers: {
        "Content-Type": blob.blob.contentType ?? "application/octet-stream",
        // Jamais de cache partagé sur une pièce d'identité.
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
      },
    });
  } catch (err) {
    console.error("[admin/pro-verification/document]", err);
    return NextResponse.json({ error: "Lecture impossible" }, { status: 500 });
  }
}

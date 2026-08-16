import { NextRequest, NextResponse } from "next/server";
import { readKycDocument } from "@/lib/kyc-storage";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-unified";

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
  // Session du site ou jeton de l'application : le modérateur instruit le même
  // dossier depuis les deux. Le rôle est relu en base, jamais déduit du jeton.
  const actor = await getAuthUser(req);
  const account = actor?.id
    ? await prisma.user.findUnique({ where: { id: actor.id }, select: { role: true } })
    : null;
  if (account?.role !== "ADMIN") {
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
    const doc = await readKycDocument(path);
    if (!doc) {
      return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
    }

    return new NextResponse(doc.body as BodyInit, {
      headers: {
        "Content-Type": doc.contentType,
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

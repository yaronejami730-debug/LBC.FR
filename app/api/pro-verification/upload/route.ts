import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

/**
 * Dépôt d'une pièce justificative de compte professionnel.
 *
 * Contrairement aux photos d'annonces, ces fichiers partent en blob **privé** :
 * une carte d'identité derrière une URL publique, même illisible, est une
 * fuite de données. Seul le `pathname` est renvoyé au client ; la lecture
 * passe ensuite par /api/admin/pro-verification/document, qui vérifie le rôle.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = String(form?.get("kind") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }
  if (kind !== "identity" && kind !== "company") {
    return NextResponse.json({ error: "Type de document inconnu" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Fichier trop lourd (8 Mo maximum)" }, { status: 413 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Format accepté : JPEG, PNG, WebP ou PDF" },
      { status: 415 },
    );
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase().slice(0, 5) : "bin";
  const pathname = `kyc/${session.user.id}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  try {
    const blob = await put(pathname, file, {
      access: "private",
      contentType: file.type,
      addRandomSuffix: false,
    });
    return NextResponse.json({ ok: true, path: blob.pathname });
  } catch (err) {
    console.error("[pro-verification/upload]", err);
    return NextResponse.json({ error: "Envoi impossible, réessayez" }, { status: 500 });
  }
}

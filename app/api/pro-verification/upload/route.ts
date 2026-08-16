import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  buildKycPath,
  isBlobConfigured,
  KycStorageUnavailableError,
  storeKycDocument,
} from "@/lib/kyc-storage";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

/** Types déduits de l'extension quand le navigateur n'annonce rien. */
const EXT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

/**
 * Type réel du fichier reçu.
 *
 * `file.type` est vide sur plusieurs sélecteurs de fichiers mobiles et sur les
 * PDF partagés depuis certaines applications : le fichier était alors rejeté
 * comme « format non accepté » alors qu'il était parfaitement valide. On
 * retombe sur l'extension, qui reste ici une information de forme, pas de
 * sécurité — le fichier n'est jamais exécuté ni servi publiquement.
 */
function resolveType(file: File): string {
  if (file.type && ALLOWED.has(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TYPES[ext] ?? file.type ?? "";
}

/**
 * Dépôt d'une pièce justificative de compte professionnel.
 *
 * Contrairement aux photos d'annonces, ces fichiers ne sont jamais publics :
 * une carte d'identité derrière une URL publique, même illisible, est une fuite
 * de données. Seul le `pathname` est renvoyé au client ; la lecture passe
 * ensuite par /api/admin/pro-verification/document, qui vérifie le rôle.
 *
 * Le stockage lui-même est choisi par `lib/kyc-storage` : blob privé en
 * production, dossier privé hors `public/` quand aucun store n'est relié.
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
  if (kind !== "identity" && kind !== "identity_back" && kind !== "company") {
    return NextResponse.json({ error: "Type de document inconnu" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Fichier vide" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Fichier trop lourd (8 Mo maximum)" }, { status: 413 });
  }

  const contentType = resolveType(file);
  if (!ALLOWED.has(contentType)) {
    return NextResponse.json(
      { error: "Format accepté : JPEG, PNG, WebP ou PDF" },
      { status: 415 },
    );
  }

  const pathname = buildKycPath(session.user.id as string, kind, file.name);

  try {
    const data = Buffer.from(await file.arrayBuffer());
    const stored = await storeKycDocument(pathname, data, contentType);
    return NextResponse.json({ ok: true, path: stored });
  } catch (err) {
    if (err instanceof KycStorageUnavailableError) {
      // Cause structurelle, pas un aléa : dire « réessayez » ferait boucler
      // l'utilisateur sur un envoi qui ne peut pas aboutir.
      console.error("[pro-verification/upload] store Blob non configuré", err);
      return NextResponse.json(
        { error: "Le dépôt de documents est momentanément indisponible. Nos équipes sont prévenues." },
        { status: 503 },
      );
    }
    // Le mode de stockage est journalisé : sans lui, « envoi impossible » ne
    // permet pas de distinguer un store Blob absent d'un incident réseau.
    console.error(
      `[pro-verification/upload] échec (${isBlobConfigured() ? "blob" : "local"})`,
      err,
    );
    return NextResponse.json({ error: "Envoi impossible, réessayez" }, { status: 500 });
  }
}

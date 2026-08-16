/**
 * Stockage des pièces justificatives de compte professionnel.
 *
 * Deux implémentations derrière la même interface :
 *
 * - **Vercel Blob privé**, dès que `BLOB_READ_WRITE_TOKEN` est présent. C'est
 *   le mode de production : pas d'URL publique, lecture authentifiée.
 * - **Disque local**, sinon. Sans store Blob relié, `put()` lève « No token
 *   found » et l'envoi échouait pour tous les formats, avec le seul message
 *   « Envoi impossible, réessayez » — le dépôt de pièces était donc bloqué en
 *   local et sur tout déploiement où le store n'avait pas été créé.
 *
 * Le repli n'écrit **jamais** dans `public/`, contrairement aux photos
 * d'annonces : ce dossier est servi tel quel par Next, et une carte d'identité
 * y serait accessible à qui devine son nom de fichier. Il écrit dans
 * `.private-uploads/`, hors des chemins servis, et la lecture reste soumise au
 * contrôle de rôle de `/api/admin/pro-verification/document`.
 *
 * Le `pathname` a la même forme dans les deux modes (`kyc/<userId>/<fichier>`),
 * si bien que les chemins déjà enregistrés en base restent valables si un store
 * Blob est ajouté plus tard — seuls les fichiers déjà déposés en local devront
 * être remontés.
 */

import { put, get, del } from "@vercel/blob";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";

/** Racine du repli local. Hors de `public/`, donc jamais servie directement. */
const LOCAL_ROOT = path.join(process.cwd(), ".private-uploads");

/**
 * Forme admise d'un chemin de pièce.
 *
 * Sert de garde-fou contre la traversée de répertoire : le chemin vient de la
 * base, mais il transite par une query string côté modérateur, et un `..` y
 * ferait lire n'importe quel fichier du serveur.
 */
const PATH_RE = /^kyc\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/;

const EXT_CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Vrai sur une plateforme au système de fichiers éphémère (Vercel).
 *
 * Le repli disque n'y a pas de sens : le dossier disparaît avec l'instance, et
 * un modérateur qui ouvrirait le dossier une heure plus tard ne trouverait
 * plus rien. Mieux vaut refuser franchement l'envoi que faire croire à un
 * dépôt réussi.
 */
function isEphemeralFilesystem(): boolean {
  return Boolean(process.env.VERCEL);
}

/** Levée quand aucun stockage durable n'est disponible. */
export class KycStorageUnavailableError extends Error {
  constructor() {
    super("Aucun stockage durable pour les pièces justificatives (BLOB_READ_WRITE_TOKEN absent)");
    this.name = "KycStorageUnavailableError";
  }
}

export function isValidKycPath(pathname: string): boolean {
  return PATH_RE.test(pathname);
}

/** Chemin absolu correspondant à un `pathname`, ou `null` s'il est suspect. */
function localFile(pathname: string): string | null {
  if (!isValidKycPath(pathname)) return null;
  const abs = path.resolve(LOCAL_ROOT, pathname);
  // Ceinture et bretelles : même si la regex laissait passer quelque chose, le
  // fichier résolu doit rester sous la racine.
  if (!abs.startsWith(LOCAL_ROOT + path.sep)) return null;
  return abs;
}

function contentTypeFromPath(pathname: string): string {
  const ext = pathname.split(".").pop()?.toLowerCase() ?? "";
  return EXT_CONTENT_TYPE[ext] ?? "application/octet-stream";
}

/** Construit le chemin d'une nouvelle pièce. */
export function buildKycPath(userId: string, kind: string, filename: string): string {
  const ext = filename.includes(".")
    ? filename.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin"
    : "bin";
  const safeUser = userId.replace(/[^A-Za-z0-9_-]/g, "");
  const rand = Math.random().toString(36).slice(2, 10);
  return `kyc/${safeUser}/${kind}-${Date.now()}-${rand}.${ext}`;
}

/** Dépose une pièce. Lève si le stockage refuse — l'appelant traduit. */
export async function storeKycDocument(
  pathname: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  if (isBlobConfigured()) {
    const blob = await put(pathname, data, {
      access: "private",
      contentType,
      addRandomSuffix: false,
    });
    return blob.pathname;
  }

  if (isEphemeralFilesystem()) throw new KycStorageUnavailableError();

  const abs = localFile(pathname);
  if (!abs) throw new Error(`Chemin de pièce invalide : ${pathname}`);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, data);
  return pathname;
}

/**
 * Relit une pièce pour un modérateur.
 *
 * Renvoie `null` si la pièce n'existe pas (chemin périmé, fichier déjà purgé),
 * pour que l'appelant réponde 404 plutôt que 500.
 */
export async function readKycDocument(
  pathname: string,
): Promise<{ body: ReadableStream | Buffer; contentType: string } | null> {
  if (!isValidKycPath(pathname)) return null;

  if (isBlobConfigured()) {
    const blob = await get(pathname, { access: "private" });
    if (!blob || blob.statusCode !== 200) return null;
    return {
      body: blob.stream,
      contentType: blob.blob.contentType ?? contentTypeFromPath(pathname),
    };
  }

  const abs = localFile(pathname);
  if (!abs) return null;
  const data = await readFile(abs).catch(() => null);
  if (!data) return null;
  return { body: data, contentType: contentTypeFromPath(pathname) };
}

/**
 * Efface des pièces.
 *
 * Ne lève jamais : la purge fait partie d'une décision de modération qui ne
 * doit pas être bloquée par un incident de stockage. Les échecs sont
 * journalisés pour reprise.
 */
export async function deleteKycDocuments(paths: string[]): Promise<void> {
  const valid = paths.filter(isValidKycPath);
  if (valid.length === 0) return;

  if (isBlobConfigured()) {
    await del(valid).catch((err) => console.error("[kyc-storage] suppression blob:", err));
    return;
  }

  await Promise.all(
    valid.map(async (p) => {
      const abs = localFile(p);
      if (!abs) return;
      await unlink(abs).catch((err: NodeJS.ErrnoException) => {
        if (err.code !== "ENOENT") console.error("[kyc-storage] suppression locale:", err);
      });
    }),
  );
}

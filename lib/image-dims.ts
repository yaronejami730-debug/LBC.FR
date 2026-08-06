import { readFile } from "node:fs/promises";
import path from "node:path";
import { unstable_cache } from "next/cache";

/** Assez pour l'en-tête d'un PNG/JPEG/WebP ; évite de rapatrier 3 Mo de photo. */
const HEADER_BYTES = 96 * 1024;

async function readLocal(src: string): Promise<Buffer | null> {
  // Un `..` dans le chemin sortirait de /public.
  if (src.includes("..")) return null;
  try {
    return await readFile(path.join(process.cwd(), "public", src.replace(/^\//, "")));
  } catch {
    return null;
  }
}

async function readRemoteHeader(src: string): Promise<Buffer | null> {
  try {
    const res = await fetch(src, {
      headers: { Range: `bytes=0-${HEADER_BYTES - 1}` },
      cache: "force-cache",
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.byteLength > 0 ? buf : null;
  } catch {
    return null;
  }
}

/**
 * Dimensions natives d'une image, fichier local de /public ou URL distante.
 *
 * Sert à la bannière d'accueil : sans width/height, le navigateur ne connaît
 * la hauteur de l'image qu'une fois les octets arrivés, et toute la page saute
 * au moment de l'affichage (CLS). Avec les dimensions, next/image réserve la
 * boîte au bon ratio dès le HTML — et peut servir une version redimensionnée
 * au lieu du PNG d'origine.
 *
 * Pour une image distante on ne télécharge que les premiers kilo-octets : les
 * dimensions vivent dans l'en-tête du fichier. Résultat mis en cache 24 h, une
 * bannière ne change pas de taille en cours de route.
 */
export const getImageDimensions = unstable_cache(
  async (src: string): Promise<{ width: number; height: number } | null> => {
    const buf = src.startsWith("http")
      ? await readRemoteHeader(src)
      : src.startsWith("/") && !src.startsWith("//")
        ? await readLocal(src)
        : null;
    if (!buf) return null;

    try {
      const sharp = (await import("sharp")).default;
      const meta = await sharp(buf).metadata();
      if (!meta.width || !meta.height) return null;
      return { width: meta.width, height: meta.height };
    } catch {
      // En-tête tronqué, format exotique, sharp indisponible : l'appelant
      // retombe sur le rendu sans dimensions.
      return null;
    }
  },
  ["image-dims"],
  { revalidate: 60 * 60 * 24 },
);

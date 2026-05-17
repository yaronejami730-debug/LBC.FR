/**
 * Prétraitement d'image pour l'OCR.
 *
 * OpenCV natif = build pénible sur Vercel → on utilise `sharp` (déjà
 * installé) pour le traitement d'image classique : auto-orientation,
 * agrandissement, niveaux de gris, étirement de contraste, débruitage,
 * accentuation. Un OCR appliqué à une image nette donne nettement
 * moins d'erreurs qu'en brut.
 */

import sharp from "sharp";

/**
 * Nettoie une image pour maximiser la lisibilité OCR.
 * @returns PNG en niveaux de gris, contrasté, prêt pour Tesseract.
 */
export async function preprocessForOcr(input: Buffer): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const width = meta.width ?? 1200;

  // Tesseract lit mieux entre ~1400 et 2400 px de large : on agrandit
  // les petites images, on borne les très grandes.
  const targetWidth = Math.min(2400, Math.max(1400, width));

  return sharp(input)
    .rotate()                        // auto-orientation via EXIF
    .resize({ width: targetWidth })  // agrandit les images trop petites
    .grayscale()
    .normalize()                     // étirement du contraste
    .median(1)                       // débruitage léger
    .sharpen()                       // accentue les contours du texte
    .toFormat("png")
    .toBuffer();
}

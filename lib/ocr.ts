/**
 * OCR via tesseract.js (WASM — aucun binaire natif, compatible Vercel).
 *
 * Lit le texte des images : références OEM, numéros de série, étiquettes
 * produit. Langues fra + eng (les références mêlent souvent les deux).
 */

import { createWorker } from "tesseract.js";

export type OcrResult = {
  /** Texte brut reconnu. */
  text: string;
  /** Confiance moyenne 0-100. */
  confidence: number;
};

/**
 * Exécute l'OCR sur un buffer image.
 *
 * Un worker est créé puis détruit par appel : simple et sans état, adapté
 * au serverless. Premier appel plus lent (téléchargement des données de
 * langue, mises en cache dans /tmp).
 */
export async function runOcr(image: Buffer, langs = "fra+eng"): Promise<OcrResult> {
  // /tmp = seul répertoire inscriptible en environnement serverless.
  const worker = await createWorker(langs, undefined, { cachePath: "/tmp" });
  try {
    const { data } = await worker.recognize(image);
    return {
      text: (data.text ?? "").trim(),
      confidence: Math.round(data.confidence ?? 0),
    };
  } finally {
    await worker.terminate();
  }
}

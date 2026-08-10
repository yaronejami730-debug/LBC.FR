import { NextRequest, NextResponse } from "next/server";
import { classifyListing } from "@/lib/listing-engine/classify";

/**
 * Classification d'un texte libre en type d'annonce.
 *
 * Livrable de la Phase 2 du moteur d'annonces. La réponse porte toujours ses
 * **preuves** : le pack l'exige (`guardrails.explain`), et sans traçabilité on
 * ne peut pas corriger une dérive de classification — on ne peut que la
 * constater.
 *
 * Trois actions possibles, jamais autre chose :
 *   autoselect — assez sûr pour préremplir
 *   confirm    — on propose, l'utilisateur valide d'un tap
 *   ask        — on pose une question ; le repli n'est jamais une catégorie
 *
 * Route publique : le texte saisi n'est pas encore une annonce, et exiger un
 * jeton empêcherait d'adapter le formulaire avant connexion.
 */
export async function POST(req: NextRequest) {
  let body: { text?: string; title?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const text = [body.text ?? body.title ?? "", body.description ?? ""].join(" ").trim();
  if (text.length < 3) {
    return NextResponse.json({ error: "Texte trop court (3 caractères minimum)" }, { status: 400 });
  }

  const result = classifyListing(text.slice(0, 4000));

  // On ne renvoie pas le nœud complet : l'appelant n'a besoin que de la clé, du
  // score et des preuves. Le reste alourdirait la réponse sans rien apporter.
  const candidates = result.candidates.map((c) => ({
    key: c.key,
    label: c.node.label,
    transactions: c.node.transactions,
    score: Math.round(c.score * 1000) / 1000,
    confidence: c.confidence,
    evidence: c.evidence,
  }));

  return NextResponse.json({
    action: result.action,
    ...(result.action === "ask"
      ? { questionId: result.questionId, question: result.question, options: result.options }
      : {}),
    ...(result.action === "autoselect" ? { chosen: result.chosen.key } : {}),
    candidates,
    cities: result.cities,
    /** Texte réellement scoré, entités retirées — sert au débogage des dérives. */
    lexicalText: result.lexicalText.trim(),
  });
}

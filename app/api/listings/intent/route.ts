import { NextRequest, NextResponse } from "next/server";
import { inferOfferIntent } from "@/lib/offer-intent";
import { FIELD_SETS } from "@/lib/offer-fields";

/**
 * Intention d'une annonce en cours de saisie.
 *
 * Existe pour l'application mobile : le moteur est du code serveur, et le
 * recopier dans le binaire garantirait qu'un ajout de motif ne soit appliqué
 * que par les utilisateurs ayant mis à jour l'app. Une table de motifs qui
 * diverge entre deux plateformes reproduit exactement le défaut d'origine —
 * deux définitions de la même chose.
 *
 * L'app garde un repli local (le `kind` de la rubrique) pour le hors ligne :
 * moins fin, jamais faux.
 *
 * Route publique et sans effet de bord : la saisie n'est pas encore une
 * annonce, et exiger un jeton ici empêcherait d'adapter le formulaire avant
 * connexion.
 */
export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams;
  const title = p.get("title") ?? "";
  if (title.trim().length < 2) {
    return NextResponse.json({ error: "Titre trop court" }, { status: 400 });
  }

  const priceRaw = p.get("price");
  const price = priceRaw ? parseFloat(priceRaw) : null;

  const intent = inferOfferIntent({
    title: title.slice(0, 200),
    description: (p.get("description") ?? "").slice(0, 2000),
    categoryId: p.get("category"),
    subcategory: p.get("subcategory"),
    price: price != null && !Number.isNaN(price) ? price : null,
  });

  return NextResponse.json(
    { intent, fieldSet: FIELD_SETS[intent.fieldSet] },
    // Même titre, même réponse : le moteur est déterministe. Un cache court
    // absorbe la frappe au clavier sans figer un déploiement.
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=600" } },
  );
}

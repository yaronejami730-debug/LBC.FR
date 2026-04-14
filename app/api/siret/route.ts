import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const siret = req.nextUrl.searchParams.get("q")?.replace(/\s/g, "");

  if (!siret || siret.length !== 14 || !/^\d+$/.test(siret)) {
    return NextResponse.json({ error: "SIRET invalide (14 chiffres requis)" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=1`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error("API indisponible");

    const data = await res.json();
    const result = data?.results?.[0];

    if (!result) {
      return NextResponse.json({ error: "SIRET introuvable" }, { status: 404 });
    }

    const companyName =
      result.nom_raison_sociale ||
      result.nom_complet ||
      result.nom_commercial ||
      null;

    const active = result.etat_administratif === "A";

    if (!active) {
      return NextResponse.json({ error: "Cette entreprise est inactive ou radiée" }, { status: 400 });
    }

    return NextResponse.json({ siret, companyName });
  } catch {
    return NextResponse.json({ error: "Impossible de vérifier le SIRET" }, { status: 500 });
  }
}

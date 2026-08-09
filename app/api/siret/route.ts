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

    // L'API renvoie l'établissement du SIRET demandé dans `matching_etablissements`
    // (le siège n'est pas forcément le bon établissement).
    const etab =
      (result.matching_etablissements ?? []).find((e: any) => e.siret === siret) ??
      result.siege ??
      null;

    const active = result.etat_administratif === "A";

    if (!active) {
      return NextResponse.json({ error: "Cette entreprise est inactive ou radiée" }, { status: 400 });
    }

    // Tout ce que l'API sait, on le renvoie : ce sont autant de champs que le
    // professionnel n'aura pas à ressaisir.
    return NextResponse.json({
      siret,
      siren: result.siren ?? siret.slice(0, 9),
      companyName,
      commercialName: result.nom_commercial ?? etab?.nom_commercial ?? null,
      address: etab?.adresse ?? result.siege?.adresse ?? null,
      city: etab?.libelle_commune ?? result.siege?.libelle_commune ?? null,
      postalCode: etab?.code_postal ?? result.siege?.code_postal ?? null,
      activity: etab?.activite_principale ?? result.activite_principale ?? null,
      category: result.section_activite_principale ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Impossible de vérifier le SIRET" }, { status: 500 });
  }
}

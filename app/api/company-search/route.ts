import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const res = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&page=1&per_page=8`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return NextResponse.json({ results: [] });

    const data = await res.json();
    const results = (data?.results ?? [])
      .filter((r: any) => r.etat_administratif === "A")
      .map((r: any) => ({
        siret: r.siege?.siret ?? null,
        siren: r.siren ?? null,
        companyName:
          r.nom_raison_sociale ||
          r.nom_complet ||
          r.nom_commercial ||
          "",
        ville: r.siege?.libelle_commune ?? "",
        activite: r.activite_principale_libelle ?? "",
      }))
      .filter((r: any) => r.companyName);

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}

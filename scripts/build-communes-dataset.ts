/**
 * Génère `data/geo/communes.json` — le référentiel géographique du moteur de
 * recommandation locale.
 *
 * Source : API Découpage administratif (geo.api.gouv.fr, données INSEE + La
 * Poste, licence ouverte). On prend les 34 900 communes plus les 45
 * arrondissements municipaux de Paris, Lyon et Marseille : sans eux, « Paris
 * 16e » et « Paris 19e » tomberaient sur le même point et la distance affichée
 * dans les emails serait fausse à l'échelle de la ville.
 *
 * Le fichier produit est versionné dans le dépôt. Le moteur ne doit jamais
 * appeler une API externe pendant un envoi : un CRON qui dépend du réseau pour
 * géocoder échoue en silence sur quelques milliers d'utilisateurs.
 *
 *     npx tsx scripts/build-communes-dataset.ts
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const API = "https://geo.api.gouv.fr/communes";
const FIELDS = "nom,code,codesPostaux,centre,population,codeDepartement";

type ApiCommune = {
  nom: string;
  code: string;
  codesPostaux?: string[];
  centre?: { coordinates: [number, number] };
  population?: number;
  codeDepartement: string;
};

async function fetchAll(): Promise<ApiCommune[]> {
  const communes: ApiCommune[] = await (
    await fetch(`${API}?fields=${FIELDS}&format=json`)
  ).json();
  const arrondissements: ApiCommune[] = await (
    await fetch(`${API}?type=arrondissement-municipal&fields=${FIELDS}&format=json`)
  ).json();
  return [...communes, ...arrondissements];
}

/** 4 décimales ≈ 11 m. Au-delà, on stocke du bruit. */
const round = (n: number) => Math.round(n * 1e4) / 1e4;

async function main() {
  const raw = await fetchAll();

  const rows: [string, string, number, number, number, string][] = [];
  const postal: Record<string, number> = {};
  const postalPop: Record<string, number> = {};

  for (const c of raw) {
    if (!c.centre?.coordinates) continue;
    const [lng, lat] = c.centre.coordinates;
    const pop = c.population ?? 0;
    const index = rows.length;
    rows.push([c.nom, c.code, round(lat), round(lng), pop, c.codeDepartement]);

    // Un code postal couvre parfois plusieurs communes ; on retient la plus
    // peuplée. C'est le meilleur pari quand l'utilisateur n'a saisi qu'un code
    // postal, et l'erreur reste très en-dessous du rayon de 20 km.
    for (const cp of c.codesPostaux ?? []) {
      if (postal[cp] === undefined || pop > postalPop[cp]) {
        postal[cp] = index;
        postalPop[cp] = pop;
      }
    }
  }

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString().slice(0, 10),
    source: "geo.api.gouv.fr — Découpage administratif (Licence Ouverte)",
    /** [nom, codeInsee, lat, lng, population, codeDepartement] */
    communes: rows,
    /** code postal → index dans `communes` */
    postal,
  };

  const dir = join(process.cwd(), "data", "geo");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, "communes.json");
  writeFileSync(out, JSON.stringify(payload));

  console.log(
    `${rows.length} communes, ${Object.keys(postal).length} codes postaux → ${out}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Verdict de prix affiché sur une annonce (« Bonne affaire », « Au-dessus du
 * marché », …).
 *
 * Deux règles tiennent tout le module :
 *
 * 1. Volume minimum. Un verdict sur trois annonces comparables ne vaut rien —
 *    un seul vendeur optimiste déplace la moyenne. Il faut au moins
 *    MIN_VEHICLE_COMPARABLES véhicules, ou MIN_GENERIC_COMPARABLES annonces
 *    ailleurs. En dessous, la fonction renvoie null et l'UI n'affiche rien.
 *
 * 2. Le versant « trop cher » est réservé aux véhicules. Une voiture se compare
 *    (marque, modèle, kilométrage) ; un canapé ou un vélo, non — deux annonces
 *    au même titre peuvent être deux objets différents. Hors véhicule on ne
 *    signale donc qu'une bonne affaire, jamais un prix excessif : se tromper
 *    dans ce sens coûte une vente à un vendeur honnête.
 *
 * Pour les véhicules, le prix attendu n'est pas une moyenne brute : il suit le
 * kilométrage (régression linéaire sur les comparables), sinon une 205 à
 * 250 000 km passerait pour une bonne affaire face à des modèles récents.
 */

/** Nombre de véhicules comparables requis avant tout verdict. */
export const MIN_VEHICLE_COMPARABLES = 40;

/** Nombre d'annonces comparables requis hors véhicule. */
export const MIN_GENERIC_COMPARABLES = 50;

export type PriceTone = "great" | "good" | "neutral" | "high";

export type Comparable = {
  price: number;
  /** Kilométrage, véhicules uniquement. */
  km?: number | null;
};

export type PriceSignal = {
  label: string;
  tone: PriceTone;
  icon: string;
  /** Écart au prix attendu, en % arrondi (négatif = moins cher). */
  deltaPct: number;
  /** Prix attendu, arrondi à l'euro. */
  expected: number;
  /** Comparables retenus après nettoyage des extrêmes. */
  count: number;
  /** Sur quoi le prix attendu est calculé. */
  basis: "km" | "median";
};

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Retire les 10 % de prix les plus bas et les plus hauts. Les annonces à 1 €
 * (« faire offre ») et les fautes de frappe à 999 999 € sont assez fréquentes
 * pour fausser une moyenne à elles seules.
 */
function trimOutliers(comps: Comparable[]): Comparable[] {
  const prices = comps.map((c) => c.price).sort((a, b) => a - b);
  const lo = quantile(prices, 0.1);
  const hi = quantile(prices, 0.9);
  const kept = comps.filter((c) => c.price >= lo && c.price <= hi);
  return kept.length >= 10 ? kept : comps;
}

/**
 * Régression linéaire prix ~ kilométrage sur les comparables.
 *
 * Renvoie null si le nuage ne permet rien de sérieux : trop peu de véhicules
 * renseignés, kilométrages tous identiques, ou pente positive (le prix
 * monterait avec les kilomètres — signe que le modèle ne décrit rien).
 */
function fitByKm(comps: Comparable[]): { intercept: number; slope: number } | null {
  const pts = comps
    .filter((c) => typeof c.km === "number" && c.km > 0)
    .map((c) => ({ price: c.price, km: c.km as number }));
  if (pts.length < MIN_VEHICLE_COMPARABLES) return null;
  if (pts.length < comps.length * 0.6) return null;

  const kms = pts.map((p) => p.km).sort((a, b) => a - b);
  // Sans étalement de kilométrage, la pente est du bruit amplifié.
  if (quantile(kms, 0.9) - quantile(kms, 0.1) < 20_000) return null;

  const n = pts.length;
  const meanKm = pts.reduce((s, p) => s + p.km, 0) / n;
  const meanPrice = pts.reduce((s, p) => s + p.price, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of pts) {
    const dk = p.km - meanKm;
    num += dk * (p.price - meanPrice);
    den += dk * dk;
  }
  if (den === 0) return null;

  const slope = num / den;
  if (slope >= 0) return null;

  return { intercept: meanPrice - slope * meanKm, slope };
}

function vehicleVerdict(delta: number): Omit<PriceSignal, "deltaPct" | "expected" | "count" | "basis"> {
  if (delta <= -0.2) return { label: "Très bonne affaire", tone: "great", icon: "local_fire_department" };
  if (delta <= -0.08) return { label: "Bonne affaire", tone: "good", icon: "trending_down" };
  if (delta < 0.08) return { label: "Dans le prix du marché", tone: "neutral", icon: "balance" };
  if (delta < 0.2) return { label: "Légèrement au-dessus du marché", tone: "neutral", icon: "info" };
  return { label: "Au-dessus du marché", tone: "high", icon: "trending_up" };
}

/**
 * Calcule le verdict, ou null s'il n'y a pas de quoi en formuler un.
 *
 * `isVehicle` ne change pas seulement le seuil de volume : hors véhicule, les
 * mentions « au-dessus du marché » sont interdites (voir en-tête).
 */
export function computePriceSignal({
  price,
  isVehicle,
  km,
  comparables,
}: {
  price: number;
  isVehicle: boolean;
  km?: number | null;
  comparables: Comparable[];
}): PriceSignal | null {
  if (!(price > 0)) return null;

  const valid = comparables.filter((c) => Number.isFinite(c.price) && c.price > 0);
  const minCount = isVehicle ? MIN_VEHICLE_COMPARABLES : MIN_GENERIC_COMPARABLES;
  if (valid.length < minCount) return null;

  const kept = trimOutliers(valid);
  if (kept.length < minCount) return null;

  const prices = kept.map((c) => c.price).sort((a, b) => a - b);
  const median = quantile(prices, 0.5);

  let expected = median;
  let basis: PriceSignal["basis"] = "median";

  if (isVehicle && typeof km === "number" && km > 0) {
    const fit = fitByKm(kept);
    if (fit) {
      const predicted = fit.intercept + fit.slope * km;
      // Un kilométrage hors du nuage extrapole vers l'absurde (prix négatif,
      // ou prix de véhicule neuf) : on borne sur l'intervalle observé.
      const clamped = Math.min(Math.max(predicted, quantile(prices, 0.1)), quantile(prices, 0.9));
      if (clamped > 0) {
        expected = clamped;
        basis = "km";
      }
    }
  }

  if (!(expected > 0)) return null;

  const delta = (price - expected) / expected;
  const common = {
    deltaPct: Math.round(delta * 100),
    expected: Math.round(expected),
    count: kept.length,
    basis,
  };

  if (isVehicle) return { ...vehicleVerdict(delta), ...common };

  // Hors véhicule : seulement le versant favorable.
  if (delta <= -0.2) return { label: "Très bonne affaire", tone: "great", icon: "local_fire_department", ...common };
  if (delta <= -0.08) return { label: "Bonne affaire", tone: "good", icon: "trending_down", ...common };
  return null;
}

/**
 * Bannières maison — ce qu'on montre quand la régie n'a rien à servir.
 *
 * Un emplacement vide est invisible : c'est correct pour le visiteur, et
 * insupportable pour qui exploite le site. On ne sait pas si l'encart est bien
 * posé, si le code s'exécute, ou si simplement aucune campagne n'est éligible —
 * les trois donnent le même écran blanc.
 *
 * D'où ce repli : à défaut de campagne payante, l'emplacement affiche une
 * bannière `Advertisement`, celles que l'équipe gère elle-même. Elles ne sont ni
 * comptées ni facturées — pas de jeton, donc pas d'événement possible. C'est
 * exactement le comportement qu'avaient déjà l'accueil et le fil de résultats,
 * étendu à tous les emplacements au lieu des deux qui avaient reçu un repli à
 * la main.
 */
import { prisma } from "@/lib/prisma";

export type HouseAd = {
  adId: string;
  title: string;
  description: string;
  imageUrl: string;
  imageUrlWide: string | null;
  ctaLabel: string;
  /** Le clic part directement : rien à mesurer, rien à protéger. */
  destinationUrl: string;
  house: true;
};

type Row = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imageUrlWide: string | null;
  destinationUrl: string;
};

/** Une bannière maison active, au hasard. `null` s'il n'y en a aucune. */
export async function pickHouseAd(): Promise<HouseAd | null> {
  const now = new Date();
  try {
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT id, title, description, "imageUrl", "imageUrlWide", "destinationUrl"
      FROM "Advertisement"
      WHERE "isActive" = true
        AND ("scheduledAt" IS NULL OR "scheduledAt" <= ${now})
        AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
      ORDER BY random()
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;

    return {
      adId: row.id,
      title: row.title,
      description: row.description,
      imageUrl: row.imageUrl,
      imageUrlWide: row.imageUrlWide,
      ctaLabel: "Découvrir",
      destinationUrl: row.destinationUrl,
      house: true,
    };
  } catch {
    // Une bannière de secours qui échoue ne doit pas faire tomber la page qui
    // l'accueille : l'emplacement redevient simplement vide.
    return null;
  }
}

/**
 * Juge unique de l'indexabilité et de la valeur SEO d'une annonce.
 *
 * Pourquoi ce fichier existe : la règle vivait en double, et les deux copies
 * avaient divergé. `app/annonce/[id]/[slug]/page.tsx` refusait l'index à une
 * annonce trop pauvre ; `app/sitemap.ts` poussait toutes les annonces publiées
 * sans exception. Le crawl du 11/08 a mesuré le résultat : sur les 213 annonces
 * annoncées à Google, **160 répondaient `noindex`**. Un sitemap qui réclame
 * l'indexation de pages qui la refusent est le signal contradictoire le plus
 * coûteux qu'un domaine jeune puisse émettre.
 *
 * Désormais une seule fonction tranche, et tout le monde l'appelle : la
 * metadata de la page, le sitemap, la file d'indexation, le tableau de bord.
 * Ils ne peuvent plus se contredire, par construction.
 *
 * Deux sorties distinctes, à ne pas confondre :
 *
 *   `indexable` — booléen, binaire, sans nuance. C'est lui qui décide du
 *   `noindex` et de l'entrée au sitemap. Les seuils sont inchangés par rapport
 *   à ce que la page appliquait déjà : on ne change pas le périmètre indexé au
 *   milieu d'une remise à plat, sinon plus rien n'est mesurable.
 *
 *   `score` — 0 à 100, continu. Il ne décide de rien ; il **classe**. Il pilote
 *   la priorité au sitemap, l'ordre de passage dans la file, et il rend visible
 *   ce qu'un booléen cache : une annonce à 48 est à deux photos de l'index,
 *   une annonce à 12 n'y sera jamais.
 */

import { resolveCity } from "@/lib/seo/city";

/** Ce dont le juge a besoin. Volontairement minimal : `select` court côté base. */
export type IndexableListingInput = {
  id: string;
  title: string;
  description: string | null;
  /** Colonne `images` : tableau JSON sérialisé. */
  images: string;
  /** Colonne `metadata` : objet JSON sérialisé. */
  metadata: string | null;
  price: number | null;
  category: string;
  subcategory: string | null;
  location: string | null;
  condition?: string | null;
  status: string;
  shadowBanned: boolean;
  deletedAt: Date | null;
  qualityScore: number | null;
  reportCount: number | null;
  imageDupCount?: number | null;
  createdAt: Date;
  updatedAt: Date;
  /** Compte professionnel vérifié — barre de qualité assouplie. */
  isPro: boolean;
};

/** Motif d'exclusion. Stocké tel quel en base pour être lisible au support. */
export type ExclusionReason =
  | "STATUS_NON_PUBLIE"
  | "SUPPRIMEE"
  | "SHADOW_BAN"
  | "IMPORTEE_SOURCE_EXTERNE"
  | "SIGNALEMENTS"
  | "QUALITE_INSUFFISANTE"
  | "DESCRIPTION_TROP_COURTE"
  | "PAS_ASSEZ_DE_PHOTOS"
  | "PHOTOS_DUPLIQUEES";

export type IndexVerdict = {
  indexable: boolean;
  /** 0-100. Toujours calculé, y compris pour une annonce exclue. */
  score: number;
  reasons: ExclusionReason[];
  /** Détail du score, pour l'affichage au tableau de bord. */
  breakdown: Record<string, number>;
  /** Ville du référentiel rattachée, ou `null`. Détermine le maillage local. */
  citySlug: string | null;
};

/**
 * Seuils de la barre de qualité. Assouplis pour les comptes professionnels :
 * une fiche pro est adossée à un SIRET contrôlé et à une adresse réelle, ce qui
 * compense un descriptif plus court.
 *
 * Exportés — et c'est le point : le formulaire de publication les affiche en
 * direct au vendeur. Le relevé du 12/08/2026 montre pourquoi. Sur 174 annonces
 * écartées, 31 le sont pour un **motif unique et réparable** : 23 à qui il
 * manque une photo, 8 à qui il manque quelques lignes. Aucune n'était sans
 * photo — dix-sept en avaient une, vingt en avaient deux, à une du seuil. La
 * médiane des descriptions trop courtes est à 157 caractères pour un seuil à
 * 250 ; huit d'entre elles sont déjà entre 180 et 250.
 *
 * Ces vendeurs ne refusent pas de faire l'effort : personne ne leur a dit qu'il
 * restait un geste à faire, ni ce qu'il rapportait. Les remettre à l'index vaut
 * +56 % d'annonces indexables (55 → 86), sans toucher à un seul seuil.
 *
 * D'où l'export plutôt qu'une copie des valeurs dans le formulaire : un seuil
 * qui bouge ici doit bouger à l'écran le même jour, sinon on promet au vendeur
 * une visibilité qu'on ne lui donne pas.
 */
export const INDEXABILITY_BAR = {
  pro: { minDescription: 180, minImages: 2, minQualityScore: 40 },
  particulier: { minDescription: 250, minImages: 3, minQualityScore: 50 },
} as const;

const BAR = INDEXABILITY_BAR;

/** Au-delà, l'annonce est traitée comme litigieuse et sort de l'index. */
const MAX_REPORTS = 3;

/** Photos strictement identiques à d'autres annonces — duplication visuelle. */
const MAX_IMAGE_DUPLICATES = 3;

function parseImages(images: string): string[] {
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed.filter((u) => typeof u === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Une annonce reprise d'un flux partenaire porte un texte qui existe déjà,
 * mot pour mot, sur le site d'origine. L'indexer revient à demander à Google
 * d'arbitrer un duplicata dans lequel nous sommes la copie. Elle reste
 * parfaitement visible aux visiteurs et ses liens restent suivis.
 */
function isImported(metadata: string | null): boolean {
  if (!metadata) return false;
  try {
    const meta = JSON.parse(metadata);
    return meta?.importedVia === "external_api" || !!meta?.externalId;
  } catch {
    return false;
  }
}

/** Interpolation linéaire bornée — sert à noter une grandeur continue. */
function ramp(value: number, floor: number, ceiling: number): number {
  if (value <= floor) return 0;
  if (value >= ceiling) return 1;
  return (value - floor) / (ceiling - floor);
}

/**
 * Évalue une annonce. Fonction pure : aucun accès base, aucun effet de bord.
 * Peut donc être appelée dans `generateMetadata` sans coût supplémentaire.
 */
export function evaluateListing(listing: IndexableListingInput): IndexVerdict {
  const reasons: ExclusionReason[] = [];
  const bar = listing.isPro ? BAR.pro : BAR.particulier;

  const images = parseImages(listing.images);
  const descriptionLength = listing.description?.trim().length ?? 0;
  const city = resolveCity(listing.location);

  // ── Éliminatoires ────────────────────────────────────────────────────────
  //
  // L'ordre suit la gravité : un statut non publié prime sur tout le reste, et
  // il ne sert à rien de reprocher trois photos manquantes à une annonce
  // supprimée.
  if (listing.status !== "APPROVED") reasons.push("STATUS_NON_PUBLIE");
  if (listing.deletedAt) reasons.push("SUPPRIMEE");
  if (listing.shadowBanned) reasons.push("SHADOW_BAN");
  if (isImported(listing.metadata)) reasons.push("IMPORTEE_SOURCE_EXTERNE");
  if ((listing.reportCount ?? 0) >= MAX_REPORTS) reasons.push("SIGNALEMENTS");
  if (listing.qualityScore != null && listing.qualityScore < bar.minQualityScore) {
    reasons.push("QUALITE_INSUFFISANTE");
  }
  if (descriptionLength < bar.minDescription) reasons.push("DESCRIPTION_TROP_COURTE");
  if (images.length < bar.minImages) reasons.push("PAS_ASSEZ_DE_PHOTOS");
  if ((listing.imageDupCount ?? 0) > MAX_IMAGE_DUPLICATES) reasons.push("PHOTOS_DUPLIQUEES");

  // ── Score ────────────────────────────────────────────────────────────────
  //
  // Les poids répondent à une question simple : « qu'est-ce qui fait qu'un
  // internaute arrivant de Google trouve sa réponse sur cette page ? »
  //
  // Le texte et les photos pèsent le plus lourd — ce sont eux qui distinguent
  // deux annonces du même canapé. La localisation vient ensuite : sans ville
  // reconnue, la page ne peut pas répondre à « canapé Cannes », ne reçoit aucun
  // lien depuis une page locale, et reste une feuille isolée dans le maillage.
  // La fraîcheur compte, mais moins : une annonce de trois mois toujours en
  // ligne reste utile, alors qu'une page sans photo ne l'est jamais.
  const breakdown: Record<string, number> = {
    // Richesse du descriptif : plein pot à partir de ~700 caractères, ce qui
    // correspond à la médiane observée sur les annonces qui performent.
    description: Math.round(24 * ramp(descriptionLength, 80, 700)),
    // Photos : la 1re est indispensable, la 6e n'apporte plus grand-chose.
    photos: Math.round(20 * ramp(images.length, 0, 6)),
    // Ville du référentiel — condition d'existence du maillage local.
    localisation: city ? 14 : 0,
    // Titre : ni tronqué, ni télégraphique. La fenêtre utile est 25-70 signes.
    titre: listing.title.trim().length >= 25 && listing.title.trim().length <= 70 ? 8 : 3,
    // Prix affiché : la donnée que l'internaute vient chercher, et le champ qui
    // rend l'`Offer` structuré exploitable.
    prix: listing.price && listing.price > 0 ? 8 : 0,
    // Sous-catégorie : c'est elle qui rattache la page à une intention précise
    // (« appartements » plutôt que « immobilier ») et à une page de liste.
    sousCategorie: listing.subcategory ? 8 : 0,
    // Score du moteur de confiance, déjà calculé ailleurs — on le reprend tel
    // quel plutôt que de réinventer une mesure concurrente.
    confiance: Math.round(10 * ramp(listing.qualityScore ?? 50, 30, 90)),
    // Fraîcheur : pleine sur 30 jours, s'éteint à 180.
    fraicheur: Math.round(8 * (1 - ramp(daysSince(listing.updatedAt), 30, 180))),
  };

  // Pénalités. Elles s'appliquent au score et non à l'éligibilité : une annonce
  // importée reste classable, elle ne passe simplement jamais devant une
  // annonce originale.
  if (isImported(listing.metadata)) breakdown.penaliteImport = -35;
  if ((listing.imageDupCount ?? 0) > 0) {
    breakdown.penalitePhotosDupliquees = -Math.min(15, (listing.imageDupCount ?? 0) * 3);
  }
  if ((listing.reportCount ?? 0) > 0) {
    breakdown.penaliteSignalements = -Math.min(20, (listing.reportCount ?? 0) * 7);
  }

  const raw = Object.values(breakdown).reduce((sum, n) => sum + n, 0);
  const score = Math.max(0, Math.min(100, raw));

  return {
    indexable: reasons.length === 0,
    score,
    reasons,
    breakdown,
    citySlug: city?.slug ?? null,
  };
}

function daysSince(date: Date): number {
  return (Date.now() - date.getTime()) / 86_400_000;
}

/**
 * Priorité `<priority>` du sitemap, dérivée du score.
 *
 * Google ignore largement ce champ, et c'est assumé : il sert surtout à notre
 * propre file d'indexation, qui traite les URL par priorité décroissante.
 */
export function sitemapPriority(score: number): number {
  if (score >= 90) return 0.9;
  if (score >= 75) return 0.8;
  if (score >= 60) return 0.7;
  if (score >= 50) return 0.6;
  return 0.5;
}

/** Palier lisible, pour le tableau de bord et les journaux. */
export type PriorityBand = "CRITIQUE" | "HAUTE" | "NORMALE" | "BASSE";

export function priorityBand(score: number, indexable: boolean): PriorityBand {
  if (!indexable) return "BASSE";
  if (score >= 90) return "CRITIQUE";
  if (score >= 75) return "HAUTE";
  if (score >= 50) return "NORMALE";
  return "BASSE";
}

/** Libellés destinés à l'interface d'administration. */
export const EXCLUSION_LABELS: Record<ExclusionReason, string> = {
  STATUS_NON_PUBLIE: "Annonce non publiée",
  SUPPRIMEE: "Annonce supprimée",
  SHADOW_BAN: "Annonce masquée par la modération",
  IMPORTEE_SOURCE_EXTERNE: "Importée d'une source externe (texte dupliqué)",
  SIGNALEMENTS: "Trop de signalements",
  QUALITE_INSUFFISANTE: "Score de qualité sous le seuil",
  DESCRIPTION_TROP_COURTE: "Description trop courte",
  PAS_ASSEZ_DE_PHOTOS: "Pas assez de photos",
  PHOTOS_DUPLIQUEES: "Photos réutilisées sur d'autres annonces",
};

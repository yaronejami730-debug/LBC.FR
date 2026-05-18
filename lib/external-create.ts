/**
 * Création d'une annonce importée depuis une source externe.
 *
 * Logique partagée entre la route HTTP `POST /api/external/listings` (push
 * par API key) et la tâche cron de synchronisation (`scripts/sync-bsk.ts`,
 * `app/api/cron/sync-external-sources`).
 *
 * Le pipeline de modération s'applique intégralement — un import externe est
 * traité comme une création utilisateur normale (mêmes signaux, même verdict).
 */

import type { PrismaClient } from "@prisma/client";
import { moderateListing } from "@/lib/moderation";
import { computeQualityScore } from "@/lib/quality-score";
import { detectCategory } from "@/lib/autoCategory";
import { extractAttributes } from "@/lib/extract-attributes";
import { scanText } from "@/lib/moderation/url-scanner";
import { scanScam } from "@/lib/moderation/scam-patterns";
import { fingerprintFields, findDuplicates, dedupSignal } from "@/lib/moderation/dedup";
import { aggregateRisk, signal, explainRisk } from "@/lib/moderation/risk-engine";
import { checkPhone, phoneStaticSignal, phoneReuseSignal } from "@/lib/moderation/phone";
import { ensureBlacklistPrimed } from "@/lib/moderation/blacklist";
import { computeTrustScore } from "@/lib/trust-score";
import { indexListing } from "@/lib/opensearch-sync";
import { CATEGORIES } from "@/lib/categories";

export type CreateExternalPayload = {
  externalId: string;
  sourceUrl?: string | null;
  title: string;
  description: string;
  price: number;
  category: string;
  subcategory?: string | null;
  location: string;
  condition?: string | null;
  images?: string[];
  phone?: string | null;
  metadata?: Record<string, unknown>;
};

export type CreateExternalResult =
  | { ok: true; deduplicated: true; listingId: string; status: string }
  | {
      ok: true;
      deduplicated: false;
      listingId: string;
      status: "APPROVED" | "PENDING" | "REJECTED";
      riskScore: number;
      decision: string;
    }
  | { ok: false; httpStatus: number; error: string };

/** Valide un payload entrant. Renvoie l'objet propre ou un message d'erreur. */
function validate(p: CreateExternalPayload): { ok: true; clean: CreateExternalPayload } | { ok: false; error: string } {
  const externalId = (p.externalId ?? "").trim();
  if (!externalId) return { ok: false, error: "externalId requis" };

  const title = (p.title ?? "").trim();
  if (title.length < 3 || title.length > 200) return { ok: false, error: "title invalide" };

  const description = (p.description ?? "").trim();
  if (description.length < 10 || description.length > 10_000)
    return { ok: false, error: "description invalide" };

  if (!p.category || typeof p.category !== "string") return { ok: false, error: "category requis" };
  const location = (p.location ?? "").trim();
  if (location.length < 2) return { ok: false, error: "location requis" };

  const price = typeof p.price === "number" ? p.price : Number(p.price);
  if (isNaN(price) || price < 0) return { ok: false, error: "price invalide" };

  return {
    ok: true,
    clean: { ...p, externalId, title, description, location, price },
  };
}

/**
 * Crée (ou retrouve) une annonce importée. Idempotent par (userId, externalId).
 */
export async function createExternalListing(
  prisma: PrismaClient,
  userId: string,
  payload: CreateExternalPayload,
  actor: string,
): Promise<CreateExternalResult> {
  const v = validate(payload);
  if (!v.ok) return { ok: false, httpStatus: 400, error: v.error };
  const p = v.clean;

  const imagesArr = Array.isArray(p.images)
    ? p.images.filter((u): u is string => typeof u === "string")
    : [];

  // ── Déduplication multi-niveaux ────────────────────────────────────────────
  // P1 : URL source exacte ; P2 : externalId ; (P3+ géré en amont par
  // `findDuplicates` SimHash plus bas).
  const externalIdMarker = `"externalId":"${p.externalId.replace(/"/g, '\\"')}"`;
  const sourceUrlMarker = p.sourceUrl
    ? `"sourceUrl":"${p.sourceUrl.replace(/"/g, '\\"')}"`
    : null;

  const existing = await prisma.listing.findFirst({
    where: {
      userId,
      deletedAt: null,
      OR: [
        { metadata: { contains: externalIdMarker } },
        ...(sourceUrlMarker ? [{ metadata: { contains: sourceUrlMarker } }] : []),
      ],
    },
    select: { id: true, status: true, metadata: true },
  });

  if (existing) {
    // Mise à jour : prix, images, état, métadonnées. Pas de re-modération
    // (les signaux comportementaux ne changent pas pour le même bien).
    const imagesArrUpdate = Array.isArray(p.images)
      ? p.images.filter((u): u is string => typeof u === "string")
      : [];
    let prevMeta: Record<string, unknown> = {};
    try {
      prevMeta = JSON.parse(existing.metadata ?? "{}");
    } catch {
      /* ignore */
    }
    const mergedMeta = {
      ...prevMeta,
      ...(p.metadata && typeof p.metadata === "object" ? p.metadata : {}),
      externalId: p.externalId,
      sourceUrl: p.sourceUrl ?? prevMeta.sourceUrl ?? null,
      lastRefreshedAt: new Date().toISOString(),
      importedVia: "external_api",
    };
    await prisma.listing.update({
      where: { id: existing.id },
      data: {
        title: p.title,
        price: p.price,
        description: p.description,
        location: p.location,
        ...(imagesArrUpdate.length > 0 ? { images: JSON.stringify(imagesArrUpdate) } : {}),
        metadata: JSON.stringify(mergedMeta),
      },
    });
    return { ok: true, deduplicated: true, listingId: existing.id, status: existing.status };
  }

  const incomingMeta = (p.metadata && typeof p.metadata === "object" ? p.metadata : {}) as Record<string, unknown>;
  const rawImmo = (incomingMeta.immo ?? null) as Record<string, any> | null;
  const rawVehicle = (incomingMeta.vehicle ?? null) as Record<string, any> | null;

  // Aplatissement immo : la page détail (`app/annonce/[id]/[slug]`) lit
  // `metadata.typeBien`, `metadata.surface`, `metadata.rooms`… en flat,
  // pas sous `metadata.immo.*`. Renomme nombrePieces → rooms etc.
  const flatImmo: Record<string, unknown> = {};
  if (rawImmo) {
    const map: Record<string, string> = {
      nombrePieces: "rooms",
      nombreChambres: "chambres",
      nombreSallesEau: "sallesEau",
    };
    for (const [k, v] of Object.entries(rawImmo)) {
      if (v === null || v === undefined) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      flatImmo[map[k] ?? k] = v;
    }
  }

  const flatVehicle: Record<string, unknown> = {};
  if (rawVehicle) {
    for (const [k, v] of Object.entries(rawVehicle)) {
      if (v === null || v === undefined) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      flatVehicle[k] = v;
    }
  }

  const baseMetadata: Record<string, unknown> = {
    ...incomingMeta,
    ...flatImmo,
    ...flatVehicle,
    externalId: p.externalId,
    sourceUrl: p.sourceUrl ?? null,
    importedAt: new Date().toISOString(),
    importedVia: "external_api",
  };

  // Colonnes scalaires extraites pour la recherche / les filtres.
  const immoSurface = typeof rawImmo?.surface === "number" ? rawImmo.surface : null;
  const immoRoomsRaw = rawImmo?.nombrePieces ?? rawImmo?.rooms;
  const immoRooms = typeof immoRoomsRaw === "number" ? immoRoomsRaw : null;
  const vehicleKm = typeof rawVehicle?.kilometrage === "number" ? rawVehicle.kilometrage : null;
  const vehicleYear = typeof rawVehicle?.annee === "number" ? rawVehicle.annee : null;

  // ── Contexte utilisateur ───────────────────────────────────────────────────
  const userRow = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, isPro: true, restrictedAt: true },
  });
  if (!userRow) return { ok: false, httpStatus: 404, error: "Compte propriétaire introuvable" };
  if (userRow.restrictedAt) return { ok: false, httpStatus: 403, error: "Compte restreint" };

  const recentListingsCount24h = await prisma.listing.count({
    where: { userId, createdAt: { gte: new Date(Date.now() - 24 * 3_600_000) } },
  });
  const accountAgeHours = (Date.now() - userRow.createdAt.getTime()) / 3_600_000;

  // ── Modération de contenu ──────────────────────────────────────────────────
  const modResult = moderateListing({
    title: p.title,
    description: p.description,
    price: p.price,
    category: p.category,
    subcategory: p.subcategory ?? null,
    location: p.location,
    condition: p.condition || "Bon état",
    images: imagesArr,
    metadata: baseMetadata,
    vehicleKm,
    vehicleYear,
    immoSurface,
    immoRooms,
    userContext: {
      accountAgeHours,
      recentListingsCount24h,
      isPro: userRow.isPro ?? false,
    },
  });

  const detected = detectCategory(p.title, p.description);
  const categoryId = CATEGORIES.find((c) => c.label === p.category)?.id ?? p.category;
  const moderationFlags = [...modResult.flags];
  if (detected && detected.confidence >= 0.6 && detected.categoryId !== categoryId) {
    moderationFlags.push({
      code: "wrong_category",
      severity: "major",
      message: `Catégorie probable : ${detected.categoryId} > ${detected.subcategory}`,
    });
  }

  // ── Signaux modération ────────────────────────────────────────────────────
  const fullText = `${p.title}\n${p.description}`;
  const dedupText = `${p.title} ${p.description}`.toLowerCase();
  const fingerprint = fingerprintFields(dedupText);

  await ensureBlacklistPrimed(prisma);
  const urlReport = scanText(fullText);
  const scamReport = scanScam(fullText);
  const dedup = await findDuplicates(prisma, dedupText, userId);

  const severityWeight = (s: string) =>
    s === "critical" ? 60 : s === "major" ? 30 : 10;
  const riskHits = [
    ...moderationFlags.map((f) =>
      signal(f.code, "quality", severityWeight(f.severity), { message: f.message }),
    ),
    ...scamReport.hits.map((h) =>
      signal(h.patternId, h.category === "phishing" ? "phishing" : "scam", h.score, {
        match: h.match,
      }),
    ),
  ];
  if (urlReport.worst) {
    riskHits.push(
      signal("url.suspect", "phishing", urlReport.totalScore, {
        host: urlReport.worst.host,
        reasons: urlReport.worst.reasons,
      }),
    );
  }
  const dupHit = dedupSignal(dedup);
  if (dupHit) riskHits.push(dupHit);

  const phoneCheck = checkPhone(typeof p.phone === "string" ? p.phone : "");
  const phoneStatic = phoneStaticSignal(phoneCheck, Boolean(p.phone));
  if (phoneStatic) riskHits.push(phoneStatic);
  if (phoneCheck.hash) {
    const reuse = await phoneReuseSignal(prisma, phoneCheck.hash, userId);
    if (reuse) riskHits.push(reuse);
  }

  const trust = await computeTrustScore({ userId });
  const risk = aggregateRisk(riskHits, trust.score);

  // ── Verdict final ─────────────────────────────────────────────────────────
  let listingStatus: "APPROVED" | "PENDING" | "REJECTED" =
    modResult.verdict === "reject"
      ? "REJECTED"
      : modResult.verdict === "review"
        ? "PENDING"
        : "APPROVED";
  let rejectionReason = modResult.publicReason;
  let shadowBanned = false;

  if (risk.decision === "block" && listingStatus === "APPROVED") {
    listingStatus = "REJECTED";
    rejectionReason = rejectionReason ?? "Annonce bloquée par le moteur de risque.";
  } else if (risk.decision === "review" && listingStatus === "APPROVED") {
    listingStatus = "PENDING";
  } else if (risk.decision === "shadow" && listingStatus === "APPROVED") {
    shadowBanned = true;
  }

  const attrs = extractAttributes(`${p.title} ${p.description}`);
  if (attrs.brand) baseMetadata.detectedBrand = attrs.brand;
  if (attrs.model) baseMetadata.detectedModel = attrs.model;
  if (attrs.year) baseMetadata.detectedYear = attrs.year;

  const quality = computeQualityScore({
    title: p.title,
    description: p.description,
    price: p.price,
    category: p.category,
    subcategory: p.subcategory ?? null,
    location: p.location,
    images: imagesArr,
    metadata: baseMetadata,
    immoSurface,
    immoRooms,
  });

  const adminNote = `[EXTERNAL_IMPORT] source=${p.sourceUrl ?? "?"} externalId=${p.externalId}\n${explainRisk(risk)}`;

  // ── Création ──────────────────────────────────────────────────────────────
  const listing = await prisma.listing.create({
    data: {
      title: p.title,
      price: p.price,
      category: p.category,
      subcategory: p.subcategory ?? null,
      description: p.description,
      location: p.location,
      condition: p.condition || "Bon état",
      images: JSON.stringify(imagesArr),
      metadata: JSON.stringify(baseMetadata),
      phone: p.phone || null,
      phoneHash: phoneCheck.hash,
      hidePhone: false,
      vehicleKm,
      vehicleYear,
      immoSurface,
      immoRooms,
      userId,
      status: listingStatus,
      rejectionReason,
      adminNote,
      shadowBanned,
      qualityScore: quality.score,
      flagsJson: JSON.stringify(moderationFlags),
      simhash: fingerprint.simhash,
      lshBand0: fingerprint.lshBand0,
      lshBand1: fingerprint.lshBand1,
      lshBand2: fingerprint.lshBand2,
      lshBand3: fingerprint.lshBand3,
      riskScore: risk.riskScore,
      riskDecision: risk.decision,
    } as any,
  });

  indexListing(listing).catch((err) =>
    console.error("[external create] OpenSearch index failed:", err),
  );

  prisma.moderationEvent
    .create({
      data: {
        listingId: listing.id,
        userId,
        actor,
        action: "external_import",
        reason: `risk=${risk.riskScore}(${risk.decision}) status=${listingStatus} externalId=${p.externalId}`,
        flagsJson: JSON.stringify(moderationFlags),
        scoreAfter: quality.score,
      } as any,
    })
    .catch(() => {});

  return {
    ok: true,
    deduplicated: false,
    listingId: listing.id,
    status: listingStatus,
    riskScore: risk.riskScore,
    decision: risk.decision,
  };
}

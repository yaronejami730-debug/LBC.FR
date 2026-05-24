import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuthUserId } from "@/lib/auth-unified";
import { prisma } from "@/lib/prisma";
import { buildSearchWhere } from "@/lib/search-where";
import { sendEmail } from "@/lib/email";
import { isEmailAllowed } from "@/lib/notifications/preferences";
import { newListingAdminEmail } from "@/lib/emails/new-listing-admin";
import { listingPublishedEmail } from "@/lib/emails/listing-published";
import { listingPendingEmail } from "@/lib/emails/listing-pending";
import { listingRejectedEmail } from "@/lib/emails/listing-rejected";
import { CATEGORIES } from "@/lib/categories";
import { moderateListing } from "@/lib/moderation";
import { detectSpam, applySpamRestriction } from "@/lib/spam-detector";
import { pingIndexNow } from "@/lib/indexnow";
import { sendPushNotification } from "@/lib/notifications/send";
import { notifyMatchingSavedSearches } from "@/lib/notify-saved-searches";
import { listingSlug } from "@/lib/listing-slug";
import { citySlug } from "@/lib/cities";
import { computeQualityScore } from "@/lib/quality-score";
import { detectCategory } from "@/lib/autoCategory";
import { extractAttributes } from "@/lib/extract-attributes";
import { scanText } from "@/lib/moderation/url-scanner";
import { scanScam } from "@/lib/moderation/scam-patterns";
import { fingerprintFields, findDuplicates, dedupSignal } from "@/lib/moderation/dedup";
import { aggregateRisk, signal, explainRisk } from "@/lib/moderation/risk-engine";
import { checkPhone, phoneStaticSignal, phoneReuseSignal } from "@/lib/moderation/phone";
import { hashImageUrls } from "@/lib/moderation/image-hash";
import { findImageDuplicates, imageDedupSignal } from "@/lib/moderation/image-dedup";
import { toSignedI64, pHashBands } from "@/lib/moderation/phash-bits";
import { ensureBlacklistPrimed } from "@/lib/moderation/blacklist";
import { computeTrustScore } from "@/lib/trust-score";
import { isOpenSearchEnabled } from "@/lib/opensearch";
import { searchListings } from "@/lib/opensearch-search";
import { indexListing } from "@/lib/opensearch-sync";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const perPage = 12;

  const params: Record<string, string> = {};
  searchParams.forEach((v, k) => { params[k] = v; });

  // Recherche OpenSearch si configurée — repli PostgreSQL en cas d'échec.
  if (isOpenSearchEnabled()) {
    try {
      const { ids, total } = await searchListings(params, page, perPage);
      const rows = ids.length
        ? await prisma.listing.findMany({
            where: { id: { in: ids } },
            include: { user: { select: { name: true, verified: true, isPro: true, companyName: true, avatar: true } } },
          })
        : [];
      const byId = new Map(rows.map((r) => [r.id, r]));
      const listings = ids.map((id) => byId.get(id)).filter(Boolean);
      return NextResponse.json({ listings, total, page, perPage });
    } catch (err) {
      console.error("[GET /api/listings] OpenSearch KO, repli PostgreSQL:", err);
    }
  }

  const where = buildSearchWhere(params);

  const sort = params.sort;
  const orderBy =
    sort === "price_asc"
      ? { price: "asc" as const }
      : sort === "price_desc"
        ? { price: "desc" as const }
        : { createdAt: "desc" as const };

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      include: { user: { select: { name: true, verified: true, isPro: true, companyName: true, avatar: true } } },
    }),
    prisma.listing.count({ where }),
  ]);

  return NextResponse.json({ listings, total, page, perPage });
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const session = { user: { id: userId } } as { user: { id: string } };

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { restrictedAt: true, emailVerified: true },
    });
    // Le gate « confirmer son email » regarde l'email lui-même, pas le badge admin.
    if (!currentUser?.emailVerified) {
      return NextResponse.json(
        { error: "Veuillez confirmer votre adresse email avant de publier une annonce." },
        { status: 403 }
      );
    }
    if (currentUser?.restrictedAt) {
      return NextResponse.json(
        { error: "Votre compte est temporairement limité. Contactez le support." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { title, price, category, subcategory, description, location, condition, images, metadata, phone, hidePhone } = body;

    if (!title || price === undefined || price === null || !category || !description || !location) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    if (typeof title !== "string" || title.trim().length < 3 || title.trim().length > 200) {
      return NextResponse.json({ error: "Titre invalide (3-200 caractères)" }, { status: 400 });
    }
    if (typeof description !== "string" || description.trim().length < 10 || description.trim().length > 10_000) {
      return NextResponse.json({ error: "Description invalide (10-10000 caractères)" }, { status: 400 });
    }
    if (typeof location !== "string" || location.trim().length < 2 || location.trim().length > 200) {
      return NextResponse.json({ error: "Localisation invalide" }, { status: 400 });
    }

    const parsedPrice = typeof price === "number" ? price : parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return NextResponse.json({ error: "Prix invalide" }, { status: 400 });
    }

    // Extract numeric range columns from metadata so they're queryable
    const metaObj = (() => {
      try { return JSON.parse(typeof metadata === "string" ? metadata : JSON.stringify(metadata || {})); }
      catch { return {}; }
    })();
    const vehicleKm   = metaObj.kilometrage ? (parseInt(metaObj.kilometrage) || null) : null;
    const vehicleYear = metaObj.annee       ? (parseInt(metaObj.annee)       || null) : null;
    const immoSurface = metaObj.surface     ? (parseFloat(metaObj.surface)   || null) : null;
    const immoRooms   = metaObj.rooms       ? (parseInt(metaObj.rooms)       || null) : null;

    // The form sends the category label (e.g. "Véhicules"); settings are keyed by ID (e.g. "vehicules")
    const categoryId = CATEGORIES.find((c) => c.label === category)?.id ?? category;
    const categorySetting = await prisma.categorySetting.findUnique({
      where: { categoryId },
    });

    const imagesArr = Array.isArray(images) ? images : [];

    let listingStatus: "APPROVED" | "PENDING" | "REJECTED";
    let rejectionReason: string | null = null;
    let adminNote: string | null = null;
    let rejectedForProActivity = false;
    let reviewPriority = 0;
    let shadowBanned = false;
    let moderationFlags: { code: string; severity: string; message: string }[] = [];

    if (categorySetting?.approvalMode === "MANUAL") {
      listingStatus = "PENDING";
    } else {
      const userRow = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { createdAt: true, isPro: true },
      });
      const recentListingsCount24h = await prisma.listing.count({
        where: {
          userId: session.user.id,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
      const accountAgeHours = userRow
        ? Math.max(0, (Date.now() - userRow.createdAt.getTime()) / (60 * 60 * 1000))
        : 0;

      const result = moderateListing({
        title,
        description,
        price: parsedPrice,
        category,
        subcategory: subcategory ?? null,
        location,
        condition: condition || "Bon état",
        images: imagesArr,
        metadata: metaObj,
        vehicleKm,
        vehicleYear,
        immoSurface,
        immoRooms,
        userContext: {
          accountAgeHours,
          recentListingsCount24h,
          isPro: userRow?.isPro ?? false,
        },
      });

      adminNote = result.adminNote;
      moderationFlags = result.flags ?? [];
      if (result.verdict === "reject") {
        listingStatus = "REJECTED";
        rejectionReason = result.publicReason;
        rejectedForProActivity = result.suggestsProActivity;
      } else if (result.verdict === "review") {
        listingStatus = "PENDING";
      } else {
        listingStatus = "APPROVED";
      }

      // Geographic spread check — if user has 3+ distinct cities in 24h → PENDING
      if (listingStatus === "APPROVED") {
        const recentLocations = await prisma.listing.findMany({
          where: {
            userId: session.user.id,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            deletedAt: null,
          },
          select: { location: true },
        });
        const extractCity = (loc: string) =>
          loc.toLowerCase()
            .replace(/\b\d+(e|ème|er|ère)?\b/g, "") // strip arrondissements/ordinals
            .replace(/\b\d{5}\b/g, "")               // strip postal codes
            .replace(/[^a-zàâäéèêëîïôùûü\s-]/g, "")
            .trim()
            .split(/\s+/)[0];                         // first word = city

        const allLocations = [...recentLocations.map((l) => l.location), location];
        const uniqueCities = new Set(allLocations.map(extractCity).filter(Boolean));
        if (uniqueCities.size >= 3) {
          listingStatus = "PENDING";
          adminNote = `[GEO_SPREAD] ${uniqueCities.size} villes distinctes en 24h : ${[...uniqueCities].join(", ")}\n` + (adminNote ?? "");
        }
      }

      // Spam score — run before creation so shouldPend can downgrade to PENDING
      if (listingStatus === "APPROVED") {
        const spamReport = await detectSpam(session.user.id as string);
        if (spamReport.shouldRestrict) {
          applySpamRestriction(session.user.id as string, spamReport).catch(console.error);
        } else if (spamReport.shouldPend) {
          listingStatus = "PENDING";
          adminNote = `[SPAM_PEND] score=${spamReport.totalScore}\n` + (adminNote ?? "");
        }
      }

      // Review priority for PENDING listings (admin queue sort)
      if (listingStatus === "PENDING") {
        if (moderationFlags.some((f) => f.code === "no_image"))                                           reviewPriority += 3;
        if (moderationFlags.some((f) => ["price_too_low", "price_too_high"].includes(f.code)))            reviewPriority += 2;
        if (moderationFlags.some((f) => f.code === "desc_too_short"))                                     reviewPriority += 2;
        if ((accountAgeHours ?? 999) < 24)                                                               reviewPriority += 3;
        if ((recentListingsCount24h ?? 0) > 10)                                                          reviewPriority += 2;
        if (adminNote?.includes("[GEO_SPREAD]"))                                                         reviewPriority += 2;
        if (adminNote?.includes("[SPAM_PEND]"))                                                          reviewPriority += 3;
      }
    }

    // ── Vérification catégorie server-side (classifier sans IA générative) ──
    const detected = detectCategory(title, description);
    const attributes = extractAttributes(`${title} ${description}`);
    if (detected && detected.confidence >= 0.6 && detected.categoryId !== categoryId) {
      if (listingStatus === "APPROVED") {
        listingStatus = "PENDING";
        reviewPriority += 2;
      }
      adminNote =
        `[WRONG_CATEGORY] choisi=${categoryId} détecté=${detected.categoryId}/${detected.subcategory} (conf ${detected.confidence.toFixed(2)})\n` +
        (adminNote ?? "");
      moderationFlags = [
        ...moderationFlags,
        {
          code: "wrong_category",
          severity: "medium",
          message: `Catégorie probable : ${detected.categoryId} > ${detected.subcategory}`,
        },
      ];
    }
    // Attributs extraits → persistés dans metadata pour filtrage/recherche
    if (attributes.brand) metaObj.detectedBrand = attributes.brand;
    if (attributes.model) metaObj.detectedModel = attributes.model;
    if (attributes.year) metaObj.detectedYear = attributes.year;

    // ── Moteur de risque unifié — phishing URL + scam + duplication ──
    // Empreinte SimHash persistée (dedup futur) + agrégation des signaux.
    const fullText = `${title}\n${description}`;
    const dedupText = `${title} ${description}`.toLowerCase();
    const fingerprint = fingerprintFields(dedupText);

    await ensureBlacklistPrimed(prisma);
    const urlReport = scanText(fullText);
    const scamReport = scanScam(fullText);
    const dedup = await findDuplicates(prisma, dedupText, session.user.id as string);

    const severityWeight = (s: string) =>
      s === "critical" ? 60 : s === "major" ? 30 : 10;
    const riskHits = [
      ...moderationFlags.map((f) =>
        signal(f.code, "quality", severityWeight(f.severity), { message: f.message })),
      ...scamReport.hits.map((h) =>
        signal(h.patternId, h.category === "phishing" ? "phishing" : "scam", h.score, {
          match: h.match,
        })),
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

    // ── Empreinte perceptuelle des images — détection de photos recyclées ──
    // Un fraudeur change d'IP/email/téléphone mais réutilise les mêmes photos.
    // Même photo sur un autre compte → signal d'arnaque fort.
    const hashedImages = await hashImageUrls(imagesArr);
    if (hashedImages.length > 0) {
      const imageDedup = await findImageDuplicates(
        prisma,
        hashedImages.map((h) => h.phash),
        session.user.id as string,
      );
      const imageHit = imageDedupSignal(imageDedup);
      if (imageHit) riskHits.push(imageHit);
    }

    // Téléphone — validité, préfixe, réutilisation multi-comptes.
    const phoneCheck = checkPhone(typeof phone === "string" ? phone : "");
    const phoneStatic = phoneStaticSignal(phoneCheck, Boolean(phone));
    if (phoneStatic) riskHits.push(phoneStatic);
    if (phoneCheck.hash) {
      const reuse = await phoneReuseSignal(prisma, phoneCheck.hash, session.user.id as string);
      if (reuse) riskHits.push(reuse);
    }

    const trust = await computeTrustScore({ userId: session.user.id as string });
    const risk = aggregateRisk(riskHits, trust.score);

    // La décision du moteur ne peut que durcir le statut, jamais l'adoucir.
    if (risk.decision === "block" && listingStatus === "APPROVED") {
      listingStatus = "REJECTED";
      rejectionReason =
        rejectionReason ?? "Votre annonce a été bloquée par notre système de sécurité.";
    } else if (risk.decision === "review" && listingStatus === "APPROVED") {
      listingStatus = "PENDING";
      reviewPriority += 4;
    } else if (risk.decision === "shadow" && listingStatus === "APPROVED") {
      shadowBanned = true;
    }
    adminNote = `${explainRisk(risk)}\n` + (adminNote ?? "");

    // Quality score
    const quality = computeQualityScore({
      title,
      description,
      price: parsedPrice,
      category,
      subcategory: subcategory ?? null,
      location,
      images: imagesArr,
      metadata: metaObj,
      immoSurface,
      immoRooms,
    });

    // Trust & safety capture: hashed IP + UA for later anomaly detection
    const rawIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null;
    const rawUa = req.headers.get("user-agent") ?? null;
    const ipHash = rawIp
      ? crypto.createHash("sha256").update(rawIp).digest("hex").slice(0, 32)
      : null;
    const uaHash = rawUa
      ? crypto.createHash("sha256").update(rawUa).digest("hex").slice(0, 32)
      : null;

    const listing = await prisma.listing.create({
      data: {
        title,
        price: parsedPrice,
        category,
        subcategory,
        description,
        location,
        condition: condition || "Bon état",
        images: JSON.stringify(imagesArr),
        metadata: JSON.stringify(metaObj),
        vehicleKm,
        vehicleYear,
        immoSurface,
        immoRooms,
        phone: phone || null,
        phoneHash: phoneCheck.hash,
        hidePhone: hidePhone === true,
        userId: session.user.id,
        status: listingStatus,
        rejectionReason,
        adminNote,
        reviewPriority,
        shadowBanned,
        qualityScore: quality.score,
        ipAtCreate: ipHash,
        uaAtCreate: uaHash,
        flagsJson: JSON.stringify(moderationFlags ?? []),
        simhash: fingerprint.simhash,
        lshBand0: fingerprint.lshBand0,
        lshBand1: fingerprint.lshBand1,
        lshBand2: fingerprint.lshBand2,
        lshBand3: fingerprint.lshBand3,
        riskScore: risk.riskScore,
        riskDecision: risk.decision,
      } as any,
    });

    // Persistance des empreintes images — alimente la détection de doublons
    // des futures annonces. Fire-and-forget : ne bloque pas la réponse.
    if (hashedImages.length > 0) {
      prisma.listingImage.createMany({
        data: hashedImages.map((h) => {
          const [b0, b1, b2, b3] = pHashBands(h.phash);
          return {
            listingId: listing.id,
            url: h.url,
            phash: toSignedI64(h.phash),
            lshBand0: b0,
            lshBand1: b1,
            lshBand2: b2,
            lshBand3: b3,
            width: h.width,
            height: h.height,
            sizeBytes: h.sizeBytes,
          };
        }),
      }).catch((err) => console.error("[ListingImage] persistance échec:", err));
    }

    // Indexation OpenSearch — fire-and-forget, ne bloque jamais la réponse.
    indexListing(listing).catch((err) =>
      console.error("[OpenSearch] indexListing échec:", err),
    );

    // Audit log
    prisma.moderationEvent.create({
      data: {
        listingId: listing.id,
        userId: session.user.id,
        actor: "system",
        action:
          listingStatus === "APPROVED"
            ? "auto_approve"
            : listingStatus === "REJECTED"
              ? "auto_reject"
              : "auto_pending",
        reason: `quality=${quality.score} risk=${risk.riskScore}(${risk.decision}) status=${listingStatus}`,
        flagsJson: JSON.stringify(moderationFlags ?? []),
        scoreAfter: quality.score,
      } as any,
    }).catch(() => {});

    // Emails vendeur + admin — fire and forget
    const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
    const parsedImages = (() => { try { return JSON.parse(JSON.stringify(images || [])) as string[]; } catch { return [] as string[]; } })();
    const adminEmail = process.env.ADMIN_EMAIL;

    const sellerUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true, companyName: true, isPro: true },
    });

    if (!sellerUser) {
      console.error("[EMAIL] sellerUser not found for", session.user.id);
    }

    if (sellerUser) {
      const displayName = sellerUser.isPro && sellerUser.companyName ? sellerUser.companyName : sellerUser.name;
      const requiresApproval = listingStatus === "PENDING";
      const wasRejected = listingStatus === "REJECTED";

      // Email vendeur — respecte les préférences (event listingPublished)
      isEmailAllowed(sellerUser.id, "listingPublished")
        .then((allowed) => {
          if (!allowed) return;
          if (wasRejected) {
            return sendEmail({
              to: sellerUser.email,
              toName: displayName,
              subject: rejectedForProActivity
                ? `Votre annonce "${title}" doit être publiée depuis un compte pro — Deal & Co`
                : `Votre annonce "${title}" n'a pas été publiée — Deal & Co`,
              html: listingRejectedEmail({
                name: displayName,
                listingTitle: title,
                reason: rejectionReason ?? undefined,
                postUrl: `${baseUrl}/post`,
                isProActivity: rejectedForProActivity,
                proUpgradeUrl: `${baseUrl}/profile?tab=pro`,
              }),
            });
          }
          if (requiresApproval) {
            return sendEmail({
              to: sellerUser.email,
              toName: displayName,
              subject: `Votre annonce "${title}" est en cours de vérification — Deal & Co`,
              html: listingPendingEmail({
                name: displayName,
                listingTitle: title,
                listingUrl: `${baseUrl}/annonce/${listing.id}`,
                price: parsedPrice,
                location,
                imageUrl: parsedImages[0] ?? undefined,
              }),
            });
          }
          return sendEmail({
            to: sellerUser.email,
            toName: displayName,
            subject: `Votre annonce "${title}" est en ligne — Deal & Co`,
            html: listingPublishedEmail({
              name: displayName,
              listingTitle: title,
              listingUrl: `${baseUrl}/annonce/${listing.id}`,
              price: parsedPrice,
              location,
              imageUrl: parsedImages[0] ?? undefined,
            }),
          });
        })
        .catch((err) => console.error("[SELLER EMAIL]", err));

      // Push vendeur — reflète le statut de l'annonce.
      const tpl = wasRejected
        ? "listing_rejected"
        : requiresApproval
          ? "listing_pending"
          : "listing_approved";
      sendPushNotification({
        userId: listing.userId,
        template: tpl,
        variables: { listingTitle: title, listingId: listing.id },
      }).catch(() => {});
      if (!wasRejected && !requiresApproval) {
        notifyMatchingSavedSearches(listing.id).catch(() => {});
      }

      // Email admin
      if (!adminEmail) {
        console.error("[ADMIN EMAIL] ADMIN_EMAIL env var not set");
      } else {
        sendEmail({
          to: adminEmail,
          toName: "Administration Deal & Co",
          adSource: "admin-new-listing",
          subject: wasRejected
            ? `🚫 Annonce auto-rejetée : ${title}`
            : requiresApproval
            ? `⚠️ Annonce en attente d'approbation : ${title}`
            : `✅ Annonce auto-approuvée : ${title}`,
          html: newListingAdminEmail({
            sellerName: sellerUser.name,
            listingTitle: title,
            price: parsedPrice,
            category,
            location,
            listingUrl: `${baseUrl}/annonce/${listing.id}`,
            adminUrl: wasRejected
              ? `${baseUrl}/admin/listings?status=REJECTED`
              : requiresApproval
              ? `${baseUrl}/admin/listings?status=PENDING`
              : `${baseUrl}/admin/listings?status=APPROVED`,
            requiresApproval,
            wasRejected,
          }),
        }).catch((err) => console.error("[ADMIN EMAIL]", err));
      }
    }

    if (listingStatus === "APPROVED") {
      const listingPublicUrl = `${baseUrl}/annonce/${listing.id}/${listingSlug(title)}`;
      const catId = CATEGORIES.find((c) => c.label === category)?.id;
      const villeSlug = location ? citySlug(location.split(/[,(]/)[0]?.trim() ?? location) : "";
      const urls = [listingPublicUrl, baseUrl, `${baseUrl}/nouveautes`];
      if (catId) urls.push(`${baseUrl}/annonces/${catId}`);
      if (villeSlug) urls.push(`${baseUrl}/ville/${villeSlug}`);
      if (catId && villeSlug) urls.push(`${baseUrl}/annonces/${catId}/${villeSlug}`);
      pingIndexNow(urls).catch(() => {});
    }

    return NextResponse.json(
      { ...listing, rejectedForProActivity },
      { status: 201 },
    );
  } catch (err) {
    console.error("[POST /api/listings]", err);
    const message = err instanceof Error ? err.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

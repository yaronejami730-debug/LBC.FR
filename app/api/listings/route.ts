import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildSearchWhere } from "@/lib/search-where";
import { sendEmail } from "@/lib/email";
import { newListingAdminEmail } from "@/lib/emails/new-listing-admin";
import { listingPublishedEmail } from "@/lib/emails/listing-published";
import { listingPendingEmail } from "@/lib/emails/listing-pending";
import { listingRejectedEmail } from "@/lib/emails/listing-rejected";
import { CATEGORIES } from "@/lib/categories";
import { moderateListing } from "@/lib/moderation";
import { detectSpam, applySpamRestriction } from "@/lib/spam-detector";
import { pingIndexNow } from "@/lib/indexnow";
import { listingSlug } from "@/lib/listing-slug";
import { citySlug } from "@/lib/cities";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const perPage = 12;

  const params: Record<string, string> = {};
  searchParams.forEach((v, k) => { params[k] = v; });

  const where = buildSearchWhere(params);

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { user: { select: { name: true, verified: true } } },
    }),
    prisma.listing.count({ where }),
  ]);

  return NextResponse.json({ listings, total, page, perPage });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { restrictedAt: true, verified: true },
    });
    if (!currentUser?.verified) {
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
        const moderationFlags = result?.flags ?? [];
        if (moderationFlags.some((f) => f.code === "no_image"))                                           reviewPriority += 3;
        if (moderationFlags.some((f) => ["price_too_low", "price_too_high"].includes(f.code)))            reviewPriority += 2;
        if (moderationFlags.some((f) => f.code === "desc_too_short"))                                     reviewPriority += 2;
        if ((accountAgeHours ?? 999) < 24)                                                               reviewPriority += 3;
        if ((recentListingsCount24h ?? 0) > 10)                                                          reviewPriority += 2;
        if (adminNote?.includes("[GEO_SPREAD]"))                                                         reviewPriority += 2;
        if (adminNote?.includes("[SPAM_PEND]"))                                                          reviewPriority += 3;
      }
    }

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
        metadata: typeof metadata === "string" ? metadata : JSON.stringify(metadata || {}),
        vehicleKm,
        vehicleYear,
        immoSurface,
        immoRooms,
        phone: phone || null,
        hidePhone: hidePhone === true,
        userId: session.user.id,
        status: listingStatus,
        rejectionReason,
        adminNote,
        reviewPriority,
      } as any,
    });

    // Emails vendeur + admin — fire and forget
    const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
    const parsedImages = (() => { try { return JSON.parse(JSON.stringify(images || [])) as string[]; } catch { return [] as string[]; } })();
    const adminEmail = process.env.ADMIN_EMAIL;

    const sellerUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, companyName: true, isPro: true },
    });

    if (!sellerUser) {
      console.error("[EMAIL] sellerUser not found for", session.user.id);
    }

    if (sellerUser) {
      const displayName = sellerUser.isPro && sellerUser.companyName ? sellerUser.companyName : sellerUser.name;
      const requiresApproval = listingStatus === "PENDING";
      const wasRejected = listingStatus === "REJECTED";

      // Email vendeur
      if (wasRejected) {
        sendEmail({
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
        }).catch((err) => console.error("[SELLER EMAIL REJECTED]", err));
      } else if (requiresApproval) {
        sendEmail({
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
        }).catch((err) => console.error("[SELLER EMAIL PENDING]", err));
      } else {
        sendEmail({
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
        }).catch((err) => console.error("[SELLER EMAIL APPROVED]", err));
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

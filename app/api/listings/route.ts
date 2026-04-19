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
      } else if (result.verdict === "review") {
        listingStatus = "PENDING";
      } else {
        listingStatus = "APPROVED";
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
      } as any,
    });

    // Email confirmation au vendeur — fire and forget
    const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
    const parsedImages = (() => { try { return JSON.parse(JSON.stringify(images || [])) as string[]; } catch { return [] as string[]; } })();
    const seller2 = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true, email: true, companyName: true, isPro: true } });
    if (seller2) {
      const displayName = seller2.isPro && seller2.companyName ? seller2.companyName : seller2.name;
      if (listingStatus === "REJECTED") {
        sendEmail({
          to: seller2.email,
          toName: displayName,
          subject: `Votre annonce "${title}" n'a pas été publiée — Deal & Co`,
          html: listingRejectedEmail({
            name: displayName,
            listingTitle: title,
            reason: rejectionReason ?? undefined,
            postUrl: `${baseUrl}/post`,
          }),
        }).catch(() => {});
      } else if (listingStatus === "PENDING") {
        sendEmail({
          to: seller2.email,
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
        }).catch(() => {});
      } else {
        sendEmail({
          to: seller2.email,
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
        }).catch(() => {});
      }
    }

    // Notification admin — fire and forget
    const adminEmail = process.env.ADMIN_EMAIL;
    const seller = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    });
    if (adminEmail && seller) {
      const requiresApproval = listingStatus === "PENDING";
      const wasRejected = listingStatus === "REJECTED";
      sendEmail({
        to: adminEmail,
        toName: "Administration Deal & Co",
        subject: wasRejected
          ? `🚫 Annonce auto-rejetée : ${title}`
          : requiresApproval
          ? `⚠️ Annonce à approuver : ${title}`
          : `Nouvelle annonce publiée : ${title}`,
        html: newListingAdminEmail({
          sellerName: seller.name,
          listingTitle: title,
          price: parsedPrice,
          category,
          location,
          listingUrl: `${baseUrl}/annonce/${listing.id}`,
          adminUrl: requiresApproval
            ? `${baseUrl}/admin/listings?status=PENDING`
            : `${baseUrl}/admin/listings`,
          requiresApproval,
        }),
      }).catch(() => {});
    }

    return NextResponse.json(listing, { status: 201 });
  } catch (err) {
    console.error("[POST /api/listings]", err);
    const message = err instanceof Error ? err.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

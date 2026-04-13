import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildSearchWhere } from "@/lib/search-where";

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

    const listing = await prisma.listing.create({
      data: {
        title,
        price: parsedPrice,
        category,
        subcategory,
        description,
        location,
        condition: condition || "Bon état",
        images: JSON.stringify(images || []),
        metadata: typeof metadata === "string" ? metadata : JSON.stringify(metadata || {}),
        vehicleKm,
        vehicleYear,
        immoSurface,
        immoRooms,
        phone: phone || null,
        hidePhone: hidePhone === true,
        userId: session.user.id,
      } as any,
    });

    return NextResponse.json(listing, { status: 201 });
  } catch (err) {
    console.error("[POST /api/listings]", err);
    const message = err instanceof Error ? err.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

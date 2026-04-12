import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const perPage = 12;

  const where = {
    ...(q && {
      OR: [
        { title: { contains: q } },
        { description: { contains: q } },
        { location: { contains: q } },
      ],
    }),
    ...(category && { category }),
  };

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
    const { title, price, category, description, location, condition, images, metadata } = body;

    if (!title || price === undefined || price === null || !category || !description || !location) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    const parsedPrice = typeof price === "number" ? price : parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return NextResponse.json({ error: "Prix invalide" }, { status: 400 });
    }

    const listing = await prisma.listing.create({
      data: {
        title,
        price: parsedPrice,
        category,
        description,
        location,
        condition: condition || "Bon état",
        images: JSON.stringify(images || []),
        metadata: metadata || "{}",
        userId: session.user.id,
      },
    });

    return NextResponse.json(listing, { status: 201 });
  } catch (err) {
    console.error("[POST /api/listings]", err);
    const message = err instanceof Error ? err.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

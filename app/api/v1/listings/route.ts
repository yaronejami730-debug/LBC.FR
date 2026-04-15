import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { listingPublishedEmail } from "@/lib/emails/listing-published";
import crypto from "crypto";

function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function resolveApiKey(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!raw || !raw.startsWith("dc_live_")) return null;

  const keyHash = hashKey(raw);
  const record = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: { select: { id: true, name: true, email: true, isPro: true, companyName: true, siret: true } } },
  });
  if (!record || record.revokedAt) return null;

  // Mise à jour lastUsedAt (non bloquant)
  prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return record.user;
}

/**
 * POST /api/v1/listings
 * Authentification : Authorization: Bearer dc_live_xxxx
 *
 * Corps attendu :
 * {
 *   title, price, category, description, location,
 *   subcategory?, condition?, phone?, hidePhone?,
 *   images?: string[],
 *   vehicle?: { marque, modele, annee, kilometrage, carburant, transmission,
 *               couleur, immatriculation, puissanceFiscale, nombrePortes,
 *               motorisation, nombreVitesses, nombrePlaces, typeVehicule,
 *               dateImmatriculation, critAir, emissionCO2,
 *               consoUrbaine, consoExtraU, consoMixte, options: string[] },
 *   immo?: { typeBien, surface, nombrePieces, ... }
 * }
 */
export async function POST(req: NextRequest) {
  const user = await resolveApiKey(req);
  if (!user) {
    return NextResponse.json(
      { error: "Clé API invalide ou manquante. Fournissez votre clé dans le header Authorization: Bearer dc_live_xxxx" },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const { title, price, category, subcategory, description, location, condition, images, phone, hidePhone, vehicle, immo } = body as any;

  if (!title || price === undefined || !category || !description || !location) {
    return NextResponse.json(
      { error: "Champs requis manquants : title, price, category, description, location" },
      { status: 400 }
    );
  }

  const parsedPrice = typeof price === "number" ? price : parseFloat(String(price));
  if (isNaN(parsedPrice) || parsedPrice < 0) {
    return NextResponse.json({ error: "price doit être un nombre positif" }, { status: 400 });
  }

  // Construire le metadata
  const metadata = vehicle
    ? JSON.stringify(vehicle)
    : immo
    ? JSON.stringify(immo)
    : "{}";

  // Colonnes indexées
  const vehicleKm   = vehicle?.kilometrage ? parseInt(vehicle.kilometrage) || null : null;
  const vehicleYear = vehicle?.annee       ? parseInt(vehicle.annee)       || null : null;
  const immoSurface = immo?.surface        ? parseFloat(immo.surface)      || null : null;
  const immoRooms   = immo?.rooms          ? parseInt(immo.rooms)          || null : null;

  const listing = await prisma.listing.create({
    data: {
      title:       String(title).trim(),
      price:       parsedPrice,
      category:    String(category),
      subcategory: subcategory ? String(subcategory) : null,
      description: String(description),
      location:    String(location),
      condition:   condition ? String(condition) : "Bon état",
      images:      JSON.stringify(Array.isArray(images) ? images : []),
      metadata,
      vehicleKm,
      vehicleYear,
      immoSurface,
      immoRooms,
      phone:     phone     ? String(phone)     : null,
      hidePhone: hidePhone === true,
      userId:    user.id,
      status:    "APPROVED",
    } as any,
  });

  // Email de confirmation — fire and forget
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
  const displayName = user.isPro && user.companyName ? user.companyName : user.name;
  sendEmail({
    to: user.email,
    toName: displayName,
    subject: `Votre annonce "${title}" est en ligne — Deal & Co`,
    html: listingPublishedEmail({
      name: displayName,
      listingTitle: String(title),
      listingUrl: `${baseUrl}/annonce/${listing.id}`,
      price: parsedPrice,
      location: String(location),
      imageUrl: Array.isArray(images) ? images[0] : undefined,
    }),
  }).catch(() => {});

  return NextResponse.json(
    {
      ok: true,
      id: listing.id,
      url: `${baseUrl}/annonce/${listing.id}`,
      status: listing.status,
      createdAt: listing.createdAt,
    },
    { status: 201 }
  );
}

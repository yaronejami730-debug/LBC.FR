import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listingSlug } from "@/lib/listing-slug";

export const runtime = "nodejs";

const MAX_SERVICES = 120;

type ServiceInput = {
  section?: string;
  label?: string;
  durationMin?: number | string | null;
  price?: number | string;
  priceNote?: string | null;
};

/**
 * Espace professionnel — lecture et enregistrement par son propriétaire.
 *
 * Réservé aux comptes `isPro`, c'est-à-dire vérifiés pièce d'identité + Kbis :
 * une fiche d'établissement engage bien plus qu'une annonce, et c'est
 * précisément ce que les faux SIRET cherchaient à obtenir.
 *
 * La carte est enregistrée par remplacement complet : le client envoie l'état
 * final: pas de diff à réconcilier, pas de ligne fantôme.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.proProfile.findUnique({
    where: { userId: session.user.id },
    include: { services: { orderBy: { position: "asc" } } },
  });

  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isPro: true, companyName: true, professionalStatus: true },
  });
  // Verrou de sécurité : PENDING, INFO_REQUESTED, REJECTED et SUSPENDED n'ont
  // aucune fonctionnalité professionnelle publique. Seul APPROVED en ouvre.
  if (!user?.isPro || user.professionalStatus !== "APPROVED") {
    return NextResponse.json(
      {
        error:
          user?.professionalStatus === "PENDING" || user?.professionalStatus === "INFO_REQUESTED"
            ? "Votre demande de compte professionnel est en cours de vérification. " +
              "Votre espace sera disponible dès sa validation."
            : user?.professionalStatus === "SUSPENDED"
              ? "Votre habilitation professionnelle est suspendue. Contactez l'équipe."
              : "L'espace professionnel est réservé aux comptes professionnels vérifiés. " +
                "Déposez votre dossier depuis votre profil pour l'activer.",
      },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? user.companyName ?? "").trim();
  if (name.length < 2) {
    return NextResponse.json({ error: "Nom de l'établissement requis" }, { status: 400 });
  }

  const rawServices: ServiceInput[] = Array.isArray(body.services) ? body.services : [];
  const services = rawServices
    .filter((s) => s && String(s.label ?? "").trim() && Number(s.price) >= 0)
    .slice(0, MAX_SERVICES)
    .map((s, i) => ({
      section: String(s.section ?? "Prestations").trim().slice(0, 60) || "Prestations",
      label: String(s.label).trim().slice(0, 120),
      durationMin: Number(s.durationMin) > 0 ? Math.min(Number(s.durationMin), 999) : null,
      price: Math.round(Number(s.price) * 100) / 100,
      priceNote: s.priceNote ? String(s.priceNote).trim().slice(0, 40) : null,
      position: i,
    }));

  const existing = await prisma.proProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, slug: true },
  });

  // Le slug ne bouge plus une fois publié : une fiche partagée doit rester
  // atteignable même si l'enseigne est renommée.
  let slug = existing?.slug;
  if (!slug) {
    const base = listingSlug(name).slice(0, 60) || "etablissement";
    slug = base;
    for (let i = 2; await prisma.proProfile.findUnique({ where: { slug } }); i++) {
      slug = `${base}-${i}`;
    }
  }

  const data = {
    name: name.slice(0, 120),
    slug,
    categories: JSON.stringify(Array.isArray(body.categories) ? body.categories.slice(0, 6) : []),
    description: body.description ? String(body.description).slice(0, 4000) : null,
    addressLine: body.addressLine ? String(body.addressLine).slice(0, 200) : null,
    city: body.city ? String(body.city).slice(0, 100) : null,
    postalCode: body.postalCode ? String(body.postalCode).slice(0, 10) : null,
    phone: body.phone ? String(body.phone).slice(0, 30) : null,
    website: body.website ? String(body.website).slice(0, 200) : null,
    hours: JSON.stringify(body.hours ?? {}),
    photos: JSON.stringify(Array.isArray(body.photos) ? body.photos.slice(0, 12) : []),
    coverImage: body.coverImage ? String(body.coverImage) : null,
    isPublished: body.isPublished !== false,
  };

  const profile = existing
    ? await prisma.proProfile.update({ where: { id: existing.id }, data })
    : await prisma.proProfile.create({ data: { ...data, userId: session.user.id } });

  await prisma.proService.deleteMany({ where: { profileId: profile.id } });
  if (services.length > 0) {
    await prisma.proService.createMany({
      data: services.map((s) => ({ ...s, profileId: profile.id })),
    });
  }

  return NextResponse.json({ ok: true, slug: profile.slug, services: services.length });
}

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProAccessError, canManageEstablishments, resolveProScope } from "@/lib/pro/access";
import { presetFor, serialize } from "@/lib/pro/capabilities";
import { listingSlug } from "@/lib/listing-slug";
import { capabilitiesForChoice, isBusinessModelChoice } from "@/lib/pro/business-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Au-delà, c'est une saisie en boucle plutôt qu'un groupe. */
const MAX_ESTABLISHMENTS = 50;

/** Boutiques accessibles au compte connecté. */
export async function GET(req: NextRequest) {
  try {
    const scope = await resolveProScope(req);
    return NextResponse.json({
      active: scope.establishment.id,
      role: scope.role,
      establishments: scope.establishments.map((e) => ({
        id: e.id,
        name: e.name,
        slug: e.slug,
        city: e.city,
        activityType: e.activityType,
        isPublished: e.isPublished,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Ouvre une boutique de plus dans la même entreprise.
 *
 * Le professionnel peut partir d'un établissement existant : on recopie ce qui
 * définit l'offre — métier, capacités, description, carte des prestations,
 * règles de réservation. On ne recopie **pas** adresse, téléphone, photos,
 * horaires ni équipe : ce sont précisément les champs qui distinguent deux
 * boutiques, et les préremplir produirait des fiches fausses.
 */
export async function POST(req: NextRequest) {
  try {
    const scope = await resolveProScope(req);
    if (!canManageEstablishments(scope.role)) {
      throw new ProAccessError(
        "Seul un propriétaire ou un administrateur peut ouvrir un établissement.",
        403,
        "FORBIDDEN",
      );
    }

    const companyId = scope.establishment.companyId;
    if (!companyId) {
      throw new ProAccessError("Entreprise introuvable.", 409, "NO_COMPANY");
    }

    const count = await prisma.proProfile.count({ where: { companyId } });
    if (count >= MAX_ESTABLISHMENTS) {
      throw new ProAccessError(`Maximum ${MAX_ESTABLISHMENTS} établissements.`, 409, "TOO_MANY");
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    if (!name) throw new ProAccessError("Le nom de l'établissement est requis.", 400, "MISSING_NAME");

    const copyFromId = body.copyFrom ? String(body.copyFrom) : null;
    const source = copyFromId ? scope.establishments.find((e) => e.id === copyFromId) ?? null : null;
    if (copyFromId && !source) {
      throw new ProAccessError("Établissement modèle introuvable.", 404, "SOURCE_NOT_FOUND");
    }

    const activityType = String(body.activityType ?? source?.activityType ?? "") || null;

    // « Que propose principalement votre entreprise ? » — la réponse arrive
    // sous forme de choix lisible et repart en capacités. Le métier ne donne
    // qu'un point de départ : deux salons de coiffure ne vendent pas forcément
    // la même chose, et c'est le professionnel qui sait s'il tient un stock.
    const businessModel = body.businessModel;
    const capabilities = source
      ? source.capabilities
      : isBusinessModelChoice(businessModel)
        ? serialize(capabilitiesForChoice(businessModel))
        : serialize(presetFor(activityType));

    const created = await prisma.proProfile.create({
      data: {
        userId: scope.userId,
        companyId,
        name: name.slice(0, 120),
        slug: await uniqueSlug(name),
        activityType,
        capabilities,
        description: source?.description ?? null,
        categories: source?.categories ?? "[]",
        city: body.city ? String(body.city).slice(0, 80) : null,
        postalCode: body.postalCode ? String(body.postalCode).slice(0, 10) : null,
        addressLine: body.addressLine ? String(body.addressLine).slice(0, 200) : null,
        // Jamais publié d'emblée : une fiche sans adresse ni horaires ne doit
        // pas apparaître côté client.
        isPublished: false,
      },
    });

    if (source) {
      const [services, settings] = await Promise.all([
        prisma.proService.findMany({ where: { profileId: source.id }, orderBy: { position: "asc" } }),
        prisma.proBookingSettings.findUnique({ where: { profileId: source.id } }),
      ]);

      if (services.length > 0) {
        await prisma.proService.createMany({
          data: services.map((s) => ({
            profileId: created.id,
            section: s.section,
            label: s.label,
            durationMin: s.durationMin,
            price: s.price,
            priceNote: s.priceNote,
            position: s.position,
            isActive: s.isActive,
            isBookable: s.isBookable,
          })),
        });
      }

      if (settings) {
        await prisma.proBookingSettings.create({
          data: {
            profileId: created.id,
            slotGranularityMin: settings.slotGranularityMin,
            bufferMin: settings.bufferMin,
            minNoticeMin: settings.minNoticeMin,
            maxAdvanceDays: settings.maxAdvanceDays,
            autoConfirm: settings.autoConfirm,
            allowCancel: settings.allowCancel,
            allowReschedule: settings.allowReschedule,
            cancelDeadlineMin: settings.cancelDeadlineMin,
          },
        });
      }
    }

    return NextResponse.json({ establishment: created, copiedFrom: source?.id ?? null }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Le slug est unique globalement : deux « Salon Corinne » doivent cohabiter. */
async function uniqueSlug(name: string): Promise<string> {
  const base = listingSlug(name) || "etablissement";
  let slug = base;
  for (let i = 2; await prisma.proProfile.findUnique({ where: { slug } }); i++) {
    slug = `${base}-${i}`;
  }
  return slug;
}

function errorResponse(error: unknown) {
  if (error instanceof ProAccessError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error("[pro] établissements", error);
  return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
}

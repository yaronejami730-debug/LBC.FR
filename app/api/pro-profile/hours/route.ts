import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ProAccessError, resolveProScope } from "@/lib/pro/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Les seules clés acceptées — l'ordre d'affichage de la fiche publique. */
const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const;

/**
 * Horaires d'ouverture affichés sur la fiche publique.
 *
 * Route séparée de `POST /api/pro-profile` pour la même raison que la
 * visibilité : l'enregistrement de la fiche remplace la carte des prestations
 * en entier. Corriger l'heure de fermeture du samedi ne doit pas passer par
 * là — un aller-retour de trop et la carte y perdait une ligne.
 *
 * Ce sont bien les horaires *affichés*, pas ceux que lit le moteur de
 * créneaux : celui-ci ne connaît que `ProWorkingHours`, membre par membre.
 * Les deux sont volontairement distincts — une boutique peut être ouverte
 * sans que personne ne soit réservable, et l'inverse arrive aussi.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (!body.hours || typeof body.hours !== "object") {
      return NextResponse.json({ error: "hours attendu (objet jour → horaire)" }, { status: 400 });
    }

    const scope = await resolveProScope(req, (body.establishmentId as string) ?? null);

    // Reconstruction complète plutôt que fusion : le formulaire envoie l'état
    // final des sept jours, une clé absente veut dire « pas d'horaire affiché ».
    const raw = body.hours as Record<string, unknown>;
    const hours: Record<string, string> = {};
    for (const day of DAYS) {
      const value = String(raw[day] ?? "").trim().slice(0, 60);
      if (value) hours[day] = value;
    }

    const profile = await prisma.proProfile.update({
      where: { id: scope.establishment.id },
      data: { hours: JSON.stringify(hours) },
      select: { slug: true },
    });

    // La fiche est rendue côté serveur : sans purge, le public lirait encore
    // l'ancien horaire de fermeture.
    revalidatePath(`/pro/${profile.slug}`);

    return NextResponse.json({ ok: true, hours });
  } catch (error) {
    if (error instanceof ProAccessError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[pro] horaires", error);
    return NextResponse.json({ error: "Enregistrement impossible" }, { status: 500 });
  }
}

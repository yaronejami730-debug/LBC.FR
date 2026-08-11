import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ProAccessError, canManageEstablishments, resolveProScope } from "@/lib/pro/access";

export const runtime = "nodejs";

/**
 * Mise en ligne / hors ligne d'une fiche établissement.
 *
 * Route séparée de l'enregistrement de la fiche pour une raison de fond : ce
 * geste doit être instantané et sans effet de bord. Passer par le formulaire
 * complet obligeait à réenregistrer la carte entière — donc à risquer
 * d'écraser une prestation en cours d'édition — pour simplement fermer la
 * vitrine le temps d'une rénovation.
 *
 * Le lien public ne change pas : hors ligne, `/pro/<slug>` répond « cet
 * établissement met à jour sa fiche » sous son propre nom. C'est ce qui permet
 * d'imprimer l'adresse sur une carte de visite sans craindre un 404 le jour où
 * la fiche est retirée.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.isPublished !== "boolean") {
      return NextResponse.json({ error: "isPublished attendu (booléen)" }, { status: 400 });
    }

    // L'établissement visé est celui du contexte courant : `?etab=`, sinon le
    // cookie, sinon le premier accessible. Un compte à trois salons ne doit
    // jamais fermer le mauvais.
    const scope = await resolveProScope(req, body.establishmentId ?? null);

    // Fermer la vitrine coupe les réservations en ligne et sort la fiche de
    // l'index : c'est une décision d'exploitation, pas de planning. Un MANAGER
    // gère un agenda, il n'éteint pas la boutique.
    if (!canManageEstablishments(scope.role)) {
      return NextResponse.json(
        { error: "Seul un responsable de l'établissement peut mettre la fiche hors ligne." },
        { status: 403 },
      );
    }

    const profile = await prisma.proProfile.update({
      where: { id: scope.establishment.id },
      data: { isPublished: body.isPublished },
      select: { slug: true, isPublished: true, name: true },
    });

    // La fiche et son tunnel de réservation sont rendus côté serveur : sans
    // purge, la version en cache continuerait d'accepter des rendez-vous sur
    // une boutique fermée.
    revalidatePath(`/pro/${profile.slug}`);
    revalidatePath(`/pro/${profile.slug}/reserver`);
    revalidatePath("/sitemap.xml");

    return NextResponse.json({
      ok: true,
      slug: profile.slug,
      name: profile.name,
      isPublished: profile.isPublished,
    });
  } catch (e) {
    if (e instanceof ProAccessError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Modification impossible" }, { status: 500 });
  }
}

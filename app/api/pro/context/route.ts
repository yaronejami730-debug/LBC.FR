import { NextResponse, type NextRequest } from "next/server";
import { ProAccessError, resolveProContext } from "@/lib/pro/access";
import { CAPABILITIES } from "@/lib/pro/capabilities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Contexte professionnel : établissement actif, capacités, vocabulaire,
 * modules visibles.
 *
 * Un seul appel pour que le web et le mobile construisent le même dashboard.
 * Aucun client n'interprète le métier lui-même — c'est ce qui garantit qu'un
 * garagiste ne verra jamais « Ajouter une prestation de 30 minutes », quelle
 * que soit la plateforme.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await resolveProContext(req);

    return NextResponse.json(
      {
        role: ctx.role,
        establishment: {
          id: ctx.establishment.id,
          name: ctx.establishment.name,
          slug: ctx.establishment.slug,
          city: ctx.establishment.city,
          activityType: ctx.establishment.activityType,
          isPublished: ctx.establishment.isPublished,
        },
        company: ctx.establishment.company
          ? {
              id: ctx.establishment.company.id,
              legalName: ctx.establishment.company.legalName,
              tradeName: ctx.establishment.company.tradeName,
            }
          : null,
        // Le sélecteur d'établissement ne s'affiche qu'au-delà d'un : un
        // indépendant ne doit jamais voir la mécanique multi-boutiques.
        establishments: ctx.establishments.map((e) => ({
          id: e.id,
          name: e.name,
          slug: e.slug,
          city: e.city,
          isPublished: e.isPublished,
        })),
        capabilities: ctx.capabilities,
        allCapabilities: CAPABILITIES,
        lexicon: ctx.lexicon,
        modules: ctx.modules,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ProAccessError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[pro] contexte", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

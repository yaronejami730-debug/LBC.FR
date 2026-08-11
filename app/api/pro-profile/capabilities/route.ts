import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ProAccessError, canManageEstablishments, resolveProScope } from "@/lib/pro/access";
import {
  CAPABILITY_LABELS,
  capabilitiesOf,
  isCapability,
  prerequisitesFor,
  serialize,
  type Capability,
} from "@/lib/pro/capabilities";

export const runtime = "nodejs";

/**
 * Activation d'une capacité sur l'établissement courant.
 *
 * Jusqu'ici les capacités n'étaient jamais écrites : elles se déduisaient du
 * métier déclaré, et un établissement créé sans métier retombait sur le repli
 * `["offerings"]`. Conséquence, sa page de configuration masquait l'équipe,
 * les règles de réservation et l'agenda — sans dire pourquoi, et sans laisser
 * de porte pour y remédier.
 *
 * On écrit donc la liste *effective* augmentée de la nouvelle capacité, jamais
 * la capacité seule : enregistrer `["staff"]` sur un salon qui tenait ses
 * `["offerings","services","bookings"]` du preset `beaute` lui ferait perdre
 * les trois au premier clic.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const capability = String(body.capability ?? "");
    if (!isCapability(capability)) {
      return NextResponse.json({ error: "Capacité inconnue" }, { status: 400 });
    }
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "enabled attendu (booléen)" }, { status: 400 });
    }

    const scope = await resolveProScope(req, body.establishmentId ?? null);

    // Ouvrir l'équipe ou la réservation engage l'exploitation de la boutique,
    // pas le planning du jour : même verrou que la mise en ligne de la fiche.
    if (!canManageEstablishments(scope.role)) {
      return NextResponse.json(
        { error: "Seul un responsable de l'établissement peut modifier ses fonctionnalités." },
        { status: 403 },
      );
    }

    const current = capabilitiesOf(scope.establishment);
    const next = body.enabled
      ? [...current, ...prerequisitesFor(capability, current), capability]
      : current.filter((c) => c !== capability);

    const serialized = serialize(next);
    const effective: Capability[] = JSON.parse(serialized);

    // `serialize()` normalise, donc il peut refuser la demande. Répondre `ok`
    // sur une liste inchangée laissait l'interface se rafraîchir à l'identique
    // et le bouton passer pour cassé : on le dit.
    if (body.enabled && !effective.includes(capability)) {
      return NextResponse.json(
        { error: `« ${CAPABILITY_LABELS[capability]} » ne peut pas être activé seul sur cet établissement.` },
        { status: 409 },
      );
    }

    const profile = await prisma.proProfile.update({
      where: { id: scope.establishment.id },
      data: { capabilities: serialized },
      select: { slug: true, capabilities: true },
    });

    // La fiche publique affiche l'équipe et le bouton de réservation : elle est
    // rendue côté serveur, donc elle ment tant qu'on ne la purge pas.
    revalidatePath(`/pro/${profile.slug}`);
    revalidatePath("/profile/espace-pro/configuration");

    return NextResponse.json({ ok: true, capabilities: JSON.parse(profile.capabilities) });
  } catch (e) {
    if (e instanceof ProAccessError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    return NextResponse.json({ error: "Modification impossible" }, { status: 500 });
  }
}

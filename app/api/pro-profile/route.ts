import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listingSlug } from "@/lib/listing-slug";
import { ProAccessError, resolveProScope } from "@/lib/pro/access";
import { syncProServices } from "@/lib/pro/services-sync";
import { normalizeWebsite } from "@/lib/pro/website";

export const runtime = "nodejs";

const MAX_SERVICES = 120;

/** Valeur numérique bornée, avec repli sur l'existant si elle est absente. */
function clamp(raw: unknown, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (raw === undefined || Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

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
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // `userId` n'est plus unique : un compte peut porter plusieurs
  // établissements. La fiche servie est celle du contexte courant — `?etab=`,
  // sinon le cookie, sinon la première accessible.
  const scope = await resolveProScope(req).catch(() => null);
  if (!scope) return NextResponse.json({ profile: null });

  const profile = await prisma.proProfile.findUnique({
    where: { id: scope.establishment.id },
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
                "Envoyez votre demande depuis votre profil pour l'activer.",
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

  // La fiche modifiée est celle de l'établissement actif, pas la première du
  // compte : sans cela, un gérant de trois salons éditant la boutique B
  // réécrivait silencieusement la boutique A.
  let existing: {
    id: string;
    slug: string;
    hours: string;
    photos: string;
    categories: string;
    coverImage: string | null;
    coverX: number;
    coverY: number;
    coverZoom: number;
    isPublished: boolean;
  } | null = null;
  try {
    const scope = await resolveProScope(req, body.establishmentId ?? null);
    existing = await prisma.proProfile.findUnique({
      where: { id: scope.establishment.id },
      // hours / photos / coverImage sont relus pour pouvoir les conserver
      // quand la requête ne les porte pas.
      select: {
        id: true,
        slug: true,
        hours: true,
        photos: true,
        categories: true,
        coverImage: true,
        coverX: true,
        coverY: true,
        coverZoom: true,
        isPublished: true,
      },
    });
  } catch (e) {
    // Aucun établissement encore créé : c'est le cas normal du premier
    // enregistrement, tout autre refus reste un refus.
    if (!(e instanceof ProAccessError) || e.code !== "NO_ESTABLISHMENT") {
      const err = e instanceof ProAccessError ? e : null;
      return NextResponse.json(
        { error: err?.message ?? "Enregistrement impossible" },
        { status: err?.status ?? 500 },
      );
    }
  }

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
    // Même règle que `hours` / `photos` : un champ absent de la requête n'est
    // pas un champ vidé. L'éditeur de fiche n'envoie pas les catégories.
    categories:
      body.categories !== undefined
        ? JSON.stringify(Array.isArray(body.categories) ? body.categories.slice(0, 6) : [])
        : (existing?.categories ?? "[]"),
    description: body.description ? String(body.description).slice(0, 4000) : null,
    addressLine: body.addressLine ? String(body.addressLine).slice(0, 200) : null,
    city: body.city ? String(body.city).slice(0, 100) : null,
    postalCode: body.postalCode ? String(body.postalCode).slice(0, 10) : null,
    phone: body.phone ? String(body.phone).slice(0, 30) : null,
    // Normalisée une fois ici : sans schéma, le lien de la fiche publique est
    // relatif et mène à /pro/<domaine> au lieu du site de l'établissement.
    website: normalizeWebsite(body.website),
    // Champ absent ≠ champ vidé. L'éditeur de fiche n'envoie ni les horaires ni
    // les photos ; les écraser à chaque enregistrement effaçait en silence ce
    // qui avait été saisi ailleurs (équipe et horaires, galerie).
    hours: body.hours !== undefined ? JSON.stringify(body.hours) : (existing?.hours ?? "{}"),
    photos:
      body.photos !== undefined
        ? JSON.stringify(Array.isArray(body.photos) ? body.photos.slice(0, 12) : [])
        : (existing?.photos ?? "[]"),
    // Ici en revanche, `null` explicite veut dire « retirer la couverture ».
    coverImage:
      body.coverImage === undefined
        ? (existing?.coverImage ?? null)
        : body.coverImage
          ? String(body.coverImage)
          : null,
    // Cadrage : borné côté serveur, le client n'est pas une autorité. Un zoom
    // négatif ou un centrage à 400 % produirait une couverture cassée.
    coverX: clamp(body.coverX, existing?.coverX ?? 50, 0, 100),
    coverY: clamp(body.coverY, existing?.coverY ?? 50, 0, 100),
    coverZoom: clamp(body.coverZoom, existing?.coverZoom ?? 1, 1, 3),
    // La mise en ligne se pilote depuis `PATCH /api/pro-profile/visibility`.
    // Un enregistrement de fiche ne la republie donc jamais tout seul : une
    // correction de tarif faite pendant une fermeture n'a pas à rouvrir la
    // vitrine. Une fiche neuve, elle, naît en ligne.
    isPublished: existing?.isPublished ?? true,
  };

  // Une exception non rattrapée renvoie ici un corps vide : l'éditeur, qui
  // attend du JSON, affichait alors « Erreur réseau » pour une panne serveur.
  // On répond toujours en JSON, quitte à dire « enregistrement impossible ».
  let profile: { id: string; slug: string };
  try {
    profile = existing
      ? await prisma.proProfile.update({ where: { id: existing.id }, data })
      : await prisma.proProfile.create({ data: { ...data, userId: session.user.id } });

    await syncProServices(profile.id, services);
  } catch (e) {
    console.error("[pro-profile] enregistrement impossible", e);
    return NextResponse.json(
      { error: "Enregistrement impossible pour le moment. Réessayez dans un instant." },
      { status: 500 },
    );
  }

  // Tarifs et prestations sont rendus côté serveur : sans purge, la fiche
  // publique afficherait l'ancienne carte jusqu'à expiration du cache.
  revalidatePath(`/pro/${profile.slug}`);
  revalidatePath(`/pro/${profile.slug}/reserver`);

  return NextResponse.json({ ok: true, slug: profile.slug, services: services.length });
}

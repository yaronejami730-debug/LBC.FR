import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { isEmailAllowed } from "@/lib/notifications/preferences";
import { categoryDigestEmail, type DigestListing } from "@/lib/emails/category-digest";
import { CATEGORIES, getCategoryByLabel } from "@/lib/categories";
import { listingUrl } from "@/lib/listing-slug";

export const runtime = "nodejs";
export const maxDuration = 300;

const BASE = "https://www.dealandcompany.fr";
const DAYS_7 = 7 * 24 * 60 * 60 * 1000;
/** Sous ce seuil, la relance n'a rien à annoncer. */
const MIN_NEW_LISTINGS = 3;
/** Un envoi par utilisateur et par semaine, toutes catégories confondues. */
const THROTTLE_MS = DAYS_7;

/**
 * Relance hebdomadaire par centre d'intérêt.
 *
 * L'intérêt d'un compte n'est pas déclaré, il se déduit de ce qu'il a fait :
 * recherches enregistrées, favoris, annonces publiées. On lui écrit sur la
 * catégorie où il est le plus actif, et seulement s'il s'y est passé quelque
 * chose depuis une semaine.
 *
 * Le rythme d'envoi est gardé dans `UserEvent` (kind `category_digest`) : un
 * journal existe déjà, inutile d'ajouter une colonne pour ça.
 */
export async function GET(req: Request) {
  // Deux appelants possibles : le planificateur Vercel, qui envoie
  // `Authorization: Bearer <CRON_SECRET>`, et un déclenchement manuel avec
  // `?secret=`. Les deux passent par le même secret.
  const secret = new URL(req.url).searchParams.get("secret");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expected = process.env.CRON_SECRET;
  if (!expected || (secret !== expected && bearer !== expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const since = new Date(now.getTime() - DAYS_7);

  // 1. Ce qui est nouveau, par catégorie.
  const fresh = await prisma.listing.groupBy({
    by: ["category"],
    where: { status: "APPROVED", shadowBanned: false, deletedAt: null, createdAt: { gte: since } },
    _count: { _all: true },
  });
  const freshByCategory = new Map(
    fresh.filter((f) => f._count._all >= MIN_NEW_LISTINGS).map((f) => [f.category, f._count._all]),
  );
  if (freshByCategory.size === 0) {
    return NextResponse.json({ sent: 0, reason: "aucune catégorie assez active" });
  }

  // 2. Quatre annonces à montrer par catégorie concernée.
  const samples = new Map<string, DigestListing[]>();
  for (const category of freshByCategory.keys()) {
    const rows = await prisma.listing.findMany({
      where: {
        category,
        status: "APPROVED",
        shadowBanned: false,
        deletedAt: null,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, title: true, price: true, location: true },
    });
    samples.set(
      category,
      rows.map((r) => ({
        title: r.title,
        price: r.price,
        location: r.location,
        url: `${BASE}${listingUrl(r.id, r.title)}`,
      })),
    );
  }

  // 3. Comptes récemment relancés — exclus d'office.
  const recentlySent = new Set(
    (
      await prisma.userEvent.findMany({
        where: { kind: "category_digest", createdAt: { gte: new Date(now.getTime() - THROTTLE_MS) } },
        select: { userId: true },
      })
    )
      .map((e) => e.userId)
      .filter((id): id is string => !!id),
  );

  const users = await prisma.user.findMany({
    where: {
      role: "USER",
      emailVerified: true,
      bannedAt: null,
      restrictedAt: null,
      id: { notIn: [...recentlySent].slice(0, 5000) },
    },
    take: 500,
    select: {
      id: true,
      name: true,
      email: true,
      savedSearches: { select: { filters: true }, take: 20 },
      favorites: { select: { listing: { select: { category: true } } }, take: 30 },
      listings: {
        where: { deletedAt: null },
        select: { category: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  let sent = 0;

  for (const user of users) {
    // 4. Poids par catégorie : une recherche enregistrée pèse plus qu'un
    //    favori isolé — elle dit une intention, pas une curiosité.
    const score = new Map<string, number>();
    const bump = (category: string | null | undefined, weight: number) => {
      if (!category || !freshByCategory.has(category)) return;
      score.set(category, (score.get(category) ?? 0) + weight);
    };

    for (const s of user.savedSearches) {
      try {
        const f = JSON.parse(s.filters) as { category?: string };
        const label = f.category
          ? (CATEGORIES.find((c) => c.id === f.category)?.label ?? f.category)
          : null;
        bump(label, 3);
      } catch {
        /* filtres illisibles — ignorés */
      }
    }
    for (const f of user.favorites) bump(f.listing?.category, 2);
    for (const l of user.listings) bump(l.category, 1);

    if (score.size === 0) continue;

    const [category] = [...score.entries()].sort((a, b) => b[1] - a[1])[0];
    const count = freshByCategory.get(category)!;
    const listings = samples.get(category) ?? [];
    if (listings.length === 0) continue;

    // « personalized » : c'est une relance construite sur le comportement du
    // compte, elle relève du désabonnement personnalisé, pas de la newsletter.
    if (!(await isEmailAllowed(user.id, "personalized").catch(() => true))) continue;

    await sendEmail({
      to: user.email,
      toName: user.name,
      subject: `${count} nouvelles annonces en ${category} — Deal & Co`,
      html: categoryDigestEmail({
        name: user.name,
        categoryLabel: category,
        count,
        listings,
        categoryUrl: `${BASE}/annonces/${getCategoryByLabel(category)?.id ?? ""}`,
      }),
      adSource: "category_digest",
      userId: user.id,
    }).catch(() => {});

    await prisma.userEvent.create({
      data: { userId: user.id, kind: "category_digest", meta: JSON.stringify({ category, count }) },
    }).catch(() => {});

    sent++;
  }

  return NextResponse.json({ sent, categories: [...freshByCategory.keys()] });
}

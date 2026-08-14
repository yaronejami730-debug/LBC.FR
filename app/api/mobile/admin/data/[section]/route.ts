import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminErrorResponse, requireMobileAdmin } from "@/lib/admin/mobile-guard";
import { CATEGORIES } from "@/lib/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Lectures de l'administration mobile, une entrée par écran.
 *
 * Les décisions passent par `/api/mobile/admin/action`, qui appelle les
 * fonctions du site. Restent les lectures : elles sont ici, alignées une à une
 * sur ce que chaque page du back-office affiche, pour que les deux écrans
 * disent la même chose au même moment.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ section: string }> }) {
  try {
    await requireMobileAdmin(req);
    const { section } = await ctx.params;
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();

    switch (section) {
      case "dashboard":
        return NextResponse.json(await dashboard());
      case "users":
        return NextResponse.json(await users(q));
      case "categories":
        return NextResponse.json(await categories());
      case "securite":
        return NextResponse.json(await securite(url.searchParams.get("tab") ?? "signalements"));
      case "crm":
        return NextResponse.json(await crm(q));
      case "annonceurs":
        return NextResponse.json(await annonceurs());
      case "ads":
        return NextResponse.json(await ads());
      case "banniere":
        return NextResponse.json(await bannieres());
      case "notifications":
        return NextResponse.json(await notifications());
      case "behavioral":
        return NextResponse.json(await behavioral());
      case "recommandations":
        return NextResponse.json(await recommandations());
      case "seo":
        return NextResponse.json(await seo());
      case "verifications":
        return NextResponse.json(await verifications(url.searchParams.get("statut") ?? "PENDING"));
      case "client":
        return NextResponse.json(await client(url.searchParams.get("id") ?? ""));
      case "trust":
        return NextResponse.json(await trust(url.searchParams.get("id") ?? ""));
      case "behavioral-batch":
        return NextResponse.json(await behavioralBatch());
      case "listing":
        return NextResponse.json(await listing(url.searchParams.get("id") ?? ""));
      case "support":
        return NextResponse.json(await support(url.searchParams.get("statut") ?? "OPEN"));
      default:
        return NextResponse.json({ error: `Section inconnue : ${section}` }, { status: 404 });
    }
  } catch (error) {
    return adminErrorResponse(error);
  }
}

/** Mêmes compteurs que la page d'accueil du back-office, mêmes filtres. */
async function dashboard() {
  const now = new Date();
  const [
    totalUsers,
    proUsers,
    pendingListings,
    activeListings,
    approvedListings,
    rejectedListings,
    totalAds,
    pendingProAccounts,
    visits30d,
    openSupport,
    recentPending,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isPro: true } }),
    prisma.listing.count({ where: { status: "PENDING", deletedAt: null } }),
    prisma.listing.count({
      where: {
        status: "APPROVED",
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    }),
    prisma.listing.count({ where: { status: "APPROVED" } }),
    prisma.listing.count({ where: { status: "REJECTED" } }),
    prisma.advertisement.count({ where: { isActive: true } }),
    prisma.user.count({ where: { professionalStatus: { in: ["PENDING", "INFO_REQUESTED"] } } }),
    prisma.userEvent.count({
      where: { kind: "page_view", createdAt: { gte: new Date(now.getTime() - 30 * DAY) } },
    }),
    prisma.supportTicket.count({ where: { status: "OPEN" } }),
    prisma.listing.findMany({
      where: { status: "PENDING", deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        price: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  return {
    stats: {
      totalUsers,
      proUsers,
      particuliers: totalUsers - proUsers,
      pendingListings,
      activeListings,
      approvedListings,
      rejectedListings,
      totalAds,
      pendingProAccounts,
      visits30d,
      openSupport,
    },
    recentPending,
  };
}

/** Liste des comptes, avec la répartition de leurs annonces. */
async function users(search: string) {
  const now = new Date();
  const rows = await prisma.user.findMany({
    orderBy: { name: "asc" },
    take: 200,
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { companyName: { contains: search, mode: "insensitive" } },
            { siret: { contains: search } },
          ],
        }
      : undefined,
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      isPro: true,
      companyName: true,
      siret: true,
      verified: true,
      adminNote: true,
      bannedAt: true,
      banReason: true,
      createdAt: true,
      _count: { select: { listings: true } },
      listings: { where: { deletedAt: null }, select: { status: true, expiresAt: true } },
    },
  });

  const list = rows.map((u) => ({
    ...u,
    listings: undefined,
    activeCount: u.listings.filter(
      (l) => l.status === "APPROVED" && (!l.expiresAt || l.expiresAt > now),
    ).length,
    pendingCount: u.listings.filter((l) => l.status === "PENDING").length,
  }));

  return {
    users: list,
    totals: {
      total: list.length,
      verified: list.filter((u) => u.verified).length,
      pro: list.filter((u) => u.isPro).length,
      particuliers: list.filter((u) => !u.isPro).length,
    },
  };
}

/** Mode d'approbation par catégorie — auto ou manuel. */
async function categories() {
  const settings = await prisma.categorySetting.findMany().catch(() => []);
  const byId = new Map(settings.map((s) => [s.categoryId, s.approvalMode]));
  return {
    categories: CATEGORIES.map((c) => ({
      categoryId: c.id,
      label: c.label,
      approvalMode: byId.get(c.id) ?? "AUTO",
    })),
  };
}

/** Centre de sécurité : compteurs et contenu de l'onglet demandé. */
async function securite(tab: string) {
  const now = Date.now();
  const [openReports, reportedListings, pendingListings, watched, banned, removed, rejected] =
    await Promise.all([
      prisma.report.count({ where: { status: "OPEN" } }),
      prisma.listing.count({ where: { reportCount: { gt: 0 }, deletedAt: null } }),
      prisma.listing.count({ where: { status: "PENDING", deletedAt: null } }),
      prisma.user.count({ where: { adminNote: { startsWith: "[SURVEILLANCE]" } } }),
      prisma.user.count({ where: { bannedAt: { not: null }, role: { not: "ADMIN" } } }),
      prisma.listing.count({ where: { status: "REMOVED" } }),
      prisma.listing.count({ where: { status: "REJECTED" } }),
    ]);

  const counters = { openReports, reportedListings, pendingListings, watched, banned, removed, rejected };

  if (tab === "retirees" || tab === "refusees") {
    const items = await prisma.listing.findMany({
      where: { status: tab === "retirees" ? "REMOVED" : "REJECTED" },
      orderBy: { removedAt: "desc" },
      take: 60,
      select: {
        id: true,
        title: true,
        price: true,
        status: true,
        rejectionReason: true,
        removedAt: true,
        permanentDeletionAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return { counters, items };
  }

  if (tab === "surveillance") {
    const items = await prisma.user.findMany({
      where: { adminNote: { startsWith: "[SURVEILLANCE]" } },
      orderBy: { name: "asc" },
      take: 60,
      select: { id: true, name: true, email: true, adminNote: true, _count: { select: { listings: true } } },
    });
    return { counters, items };
  }

  if (tab === "bannis") {
    const items = await prisma.user.findMany({
      where: { bannedAt: { not: null }, role: { not: "ADMIN" } },
      orderBy: { bannedAt: "desc" },
      take: 60,
      select: { id: true, name: true, email: true, bannedAt: true, banReason: true },
    });
    return { counters, items };
  }

  if (tab === "historique") {
    const items = await prisma.moderationEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      select: { id: true, action: true, actor: true, reason: true, createdAt: true, listingId: true, userId: true },
    });
    return { counters, items };
  }

  // Onglet « Signalements » par défaut.
  const items = await prisma.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    take: 60,
    select: {
      id: true,
      category: true,
      message: true,
      createdAt: true,
      reporter: { select: { id: true, name: true } },
      listing: { select: { id: true, title: true, status: true, reportCount: true } },
    },
  });
  return { counters, items, since: new Date(now - 7 * DAY) };
}

/** CRM : clients récents et sources externes. */
async function crm(search: string) {
  const [clients, sources] = await Promise.all([
    prisma.user.findMany({
      where: {
        isPro: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
                { companyName: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        name: true,
        email: true,
        companyName: true,
        siret: true,
        createdAt: true,
        emailVerified: true,
        _count: { select: { listings: true } },
      },
    }),
    prisma.externalSource.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
  ]);
  return { clients, sources };
}

/** Demandes d'annonceurs, avec la répartition du pipeline. */
async function annonceurs() {
  const [leads, counts] = await Promise.all([
    prisma.advertiserLead.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.advertiserLead.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return {
    leads,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
  };
}

/** Campagnes publicitaires, avec impressions et clics. */
async function ads() {
  const rows = await prisma.advertisement.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return { ads: rows };
}

/** Bannières de la page d'accueil. */
async function bannieres() {
  const rows = await prisma.heroBanner.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return { banners: rows };
}

/** Audiences disponibles pour un envoi. */
async function notifications() {
  const [pushAudience, emailAudience, pro, particuliers] = await Promise.all([
    prisma.expoPushToken.count({ where: { disabledAt: null } }),
    prisma.user.count({ where: { marketingConsent: true } }),
    prisma.user.count({ where: { isPro: true } }),
    prisma.user.count({ where: { isPro: false } }),
  ]);
  return { audiences: { pushAudience, emailAudience, pro, particuliers } };
}

/** Moteur comportemental : volumes de brouillons et de visites de publication. */
async function behavioral() {
  const now = Date.now();
  const [drafts, draftsWithContent, postVisitors7d, events24h] = await Promise.all([
    prisma.draft.count(),
    prisma.draft.count({ where: { completeness: { gt: 0 } } }),
    prisma.userEvent.findMany({
      where: {
        kind: "page_view",
        path: { startsWith: "/post" },
        userId: { not: null },
        createdAt: { gte: new Date(now - 7 * DAY) },
      },
      select: { userId: true },
      distinct: ["userId"],
      take: 500,
    }),
    prisma.userEvent.count({ where: { createdAt: { gte: new Date(now - DAY) } } }),
  ]);

  return {
    stats: {
      drafts,
      draftsWithContent,
      postVisitors7d: postVisitors7d.length,
      events24h,
    },
  };
}

/** Recommandations : catégories disponibles pour une simulation. */
async function recommandations() {
  const [profiles, withZones] = await Promise.all([
    prisma.userCategoryInterest.count().catch(() => 0),
    prisma.userLocationProfile.count().catch(() => 0),
  ]);
  return {
    categories: CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
    stats: { profiles, withZones },
  };
}

/** Indexation : répartition par statut et par type de page. */
async function seo() {
  const [total, byStatus, byType, indexable, inSitemap, discovered24h] = await Promise.all([
    prisma.seoUrl.count(),
    prisma.seoUrl.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.seoUrl.groupBy({ by: ["type"], _count: { _all: true } }),
    prisma.seoUrl.count({ where: { indexable: true } }),
    prisma.seoUrl.count({ where: { inSitemap: true } }),
    prisma.seoUrl.count({ where: { firstSeenAt: { gte: new Date(Date.now() - DAY) } } }),
  ]);
  return {
    total,
    indexable,
    inSitemap,
    discovered24h,
    byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])),
    byType: Object.fromEntries(byType.map((row) => [row.type, row._count._all])),
  };
}

/**
 * Dossiers de vérification professionnelle, pièces comprises.
 *
 * Les chemins des pièces sont servis, jamais leur contenu : l'application les
 * demande ensuite une par une à `/api/admin/pro-verification/document`, qui
 * revérifie le rôle. Un document d'identité ne transite pas dans une réponse de
 * liste, où il finirait dans un cache.
 */
async function verifications(statut: string) {
  const requests = await prisma.proVerification.findMany({
    where: statut === "ALL" ? {} : { status: statut },
    orderBy: { submittedAt: "asc" },
    take: 60,
    include: {
      logs: { orderBy: { createdAt: "desc" }, take: 20 },
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          isPro: true,
          phoneNumber: true,
          emailVerified: true,
          phoneVerified: true,
          professionalStatus: true,
          _count: { select: { listings: true } },
        },
      },
    },
  });

  const counts = await prisma.proVerification.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  return {
    requests,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
  };
}

/** Fiche client du CRM : identité, sanctions, et ses annonces. */
async function client(id: string) {
  if (!id) return { error: "Identifiant requis" };

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      isPro: true,
      companyName: true,
      siret: true,
      verified: true,
      lastLoginAt: true,
      createdAt: true,
      consentGivenAt: true,
      bannedAt: true,
      banReason: true,
      watchedAt: true,
      watchReason: true,
      phoneNumber: true,
      adminNote: true,
      role: true,
      _count: { select: { listings: { where: { deletedAt: null } } } },
    },
  });
  if (!user) return { error: "Compte introuvable" };

  const listings = await prisma.listing.findMany({
    where: { userId: id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      title: true,
      price: true,
      status: true,
      category: true,
      subcategory: true,
      location: true,
      images: true,
      createdAt: true,
      rejectionReason: true,
    },
  });

  return {
    user,
    listings: listings.map((l) => ({ ...l, images: parseImages(l.images) })),
  };
}

/** Score de confiance d'un compte — le même profil que le dossier du site. */
async function trust(id: string) {
  if (!id) return { error: "Identifiant requis" };
  const { buildTrustProfile } = await import("@/lib/moderation/trust-profile");
  const profile = await buildTrustProfile(id);
  return { profile };
}

/**
 * Le lot de décisions du moteur comportemental, ligne par ligne.
 *
 * Même sélection que le site : brouillons vivants sur 30 jours et visiteurs de
 * la publication sur 7 jours, passés un par un dans le moteur de décision. Le
 * calcul est identique — c'est la même fonction.
 */
async function behavioralBatch() {
  const { decideForUser } = await import("@/lib/behavioral/decide");
  const now = Date.now();
  const MAX_ROWS = 50;

  const [draftUsers, postVisitors] = await Promise.all([
    prisma.draft.findMany({
      where: { updatedAt: { gte: new Date(now - 30 * DAY) }, completeness: { gt: 0 } },
      select: { userId: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.userEvent.findMany({
      where: {
        kind: "page_view",
        path: { startsWith: "/post" },
        userId: { not: null },
        createdAt: { gte: new Date(now - 7 * DAY) },
      },
      select: { userId: true },
      distinct: ["userId"],
      take: 200,
    }),
  ]);

  const ids = new Set<string>();
  for (const d of draftUsers) ids.add(d.userId);
  for (const e of postVisitors) if (e.userId) ids.add(e.userId);

  const list = [...ids].slice(0, MAX_ROWS);
  const users = await prisma.user.findMany({
    where: { id: { in: list } },
    select: { id: true, email: true, name: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  const rows = [];
  for (const userId of list) {
    const u = byId.get(userId);
    if (!u) continue;
    const decision = await decideForUser(prisma, userId);
    rows.push({
      userId,
      email: u.email,
      name: u.name,
      envoyer: decision.envoyer,
      reason: decision.envoyer
        ? decision.raison
        : (decision.debug?.friction.reason ?? "none"),
      decisionReason: decision.envoyer ? "envoyer" : decision.raison,
      intent: decision.niveau_intention ?? 0,
      friction: decision.niveau_friction ?? 0,
      proba: decision.envoyer ? decision.probabilite_publication : 0,
      canal: decision.envoyer ? decision.canal : "—",
      action: decision.envoyer ? decision.action_recommandee : "—",
      heure: decision.envoyer ? decision.heure_ideale : "—",
      hot: decision.envoyer ? decision.moment_emotionnel_detecte : false,
    });
  }
  rows.sort((a, b) => b.proba - a.proba);
  return { rows };
}

/** Une annonce, telle que l'admin l'édite. */
async function listing(id: string) {
  if (!id) return { error: "Identifiant requis" };
  const row = await prisma.listing.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      category: true,
      subcategory: true,
      location: true,
      condition: true,
      images: true,
      phone: true,
      hidePhone: true,
      status: true,
      adminNote: true,
      rejectionReason: true,
      reportCount: true,
      riskScore: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!row) return { error: "Annonce introuvable" };
  return { listing: { ...row, images: parseImages(row.images) } };
}

function parseImages(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** File du support : les mêmes fils que `/admin/support`, mêmes tris. */
async function support(statut: string) {
  const [tickets, counts] = await Promise.all([
    prisma.supportTicket.findMany({
      where: statut === "ALL" ? {} : { status: statut },
      // « À traiter » se vide du plus ancien au plus récent : celui qui attend
      // depuis trois jours passe avant le dernier arrivé.
      orderBy: statut === "OPEN" ? { lastMessageAt: "asc" } : { lastMessageAt: "desc" },
      take: 60,
      include: {
        assignedTo: { select: { id: true, name: true } },
        listing: { select: { id: true, title: true } },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isPro: true,
            createdAt: true,
            bannedAt: true,
            _count: { select: { listings: true } },
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { sender: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.supportTicket.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  return {
    tickets,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
  };
}

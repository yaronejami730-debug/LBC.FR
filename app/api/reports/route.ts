import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removeListing } from "@/lib/moderation/removal";
import { notifyAdmins } from "@/lib/expo-push";

const VALID_CATEGORIES = new Set([
  "scam",
  "spam",
  "illegal",
  "offensive",
  "fake",
  "wrong_category",
  "duplicate",
  "personal_data",
  "stolen_photos",
  "other",
]);

/**
 * Seuils de signalement.
 *
 * `ATTENTION_THRESHOLD` ne retire rien : il fait remonter l'annonce en tête de
 * la file de modération. Trois personnes ne décident pas d'un retrait — c'était
 * pourtant le cas avant, l'annonce basculait en `PENDING`, donc hors ligne :
 * trois comptes complices suffisaient à faire tomber un concurrent.
 *
 * `AUTO_REMOVE_THRESHOLD` retire, lui. Vingt signalements *ouverts*, c'est-à-dire
 * accumulés depuis la dernière décision d'un administrateur : si celui-ci a
 * tranché « on laisse en ligne », le compteur repart de zéro et il faut vingt
 * nouveaux signalements pour revenir le déranger. L'humain garde le dernier mot,
 * l'automatisme n'est qu'un filet pour la nuit et le week-end.
 */
const ATTENTION_THRESHOLD = 3;
const AUTO_REMOVE_THRESHOLD = 20;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const reporterId = session.user.id;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { listingId, category, message } = body as {
    listingId?: string;
    category?: string;
    message?: string;
  };

  if (!listingId || typeof listingId !== "string") {
    return NextResponse.json({ error: "listingId required" }, { status: 400 });
  }
  if (!category || !VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (message && message.length > 500) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    // `title` sert à l'alerte poussée vers les administrateurs : un
    // signalement sans le titre de l'annonce oblige à ouvrir l'application
    // pour savoir de quoi il s'agit.
    select: { id: true, title: true, userId: true, status: true, reportCount: true } as any,
  }) as any;
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }
  if (listing.userId === reporterId) {
    return NextResponse.json({ error: "Cannot report own listing" }, { status: 400 });
  }

  // De-dup: one open report per (listing, reporter, category)
  const existing = await prisma.report.findFirst({
    where: { listingId, reporterId, category, status: "OPEN" } as any,
  }).catch(() => null);
  if (existing) {
    return NextResponse.json({ ok: true, dedup: true });
  }

  // Rate limit: reporter cannot file >5 reports in 1h
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.report.count({
    where: { reporterId, createdAt: { gte: oneHourAgo } } as any,
  }).catch(() => 0);
  if (recent >= 5) {
    return NextResponse.json(
      { error: "Trop de signalements. Réessayez plus tard." },
      { status: 429 },
    );
  }

  await prisma.report.create({
    data: {
      listingId,
      userId: listing.userId,
      reporterId,
      category,
      message: message?.trim() || null,
    } as any,
  });

  // Alerte immédiate sur les appareils en mode administrateur : un signalement
  // qui attend le prochain passage dans le back-office laisse en ligne un
  // contenu que quelqu'un vient de juger frauduleux.
  notifyAdmins({
    title: "Annonce signalée",
    body: `${listing.title} — motif : ${category}`,
    data: { type: "admin_report", listingId, reportCategory: category },
  }).catch(() => {});

  // Increment listing reportCount + user totalReportsAgainst
  const updatedListing = await prisma.listing.update({
    where: { id: listingId },
    data: { reportCount: { increment: 1 } } as any,
    select: { reportCount: true, status: true, userId: true } as any,
  }) as any;

  await prisma.user.update({
    where: { id: listing.userId },
    data: { totalReportsAgainst: { increment: 1 } } as any,
  }).catch(() => {});

  // Signalements encore ouverts, donc postérieurs à la dernière décision
  // d'un administrateur. C'est ce compteur-là qui pilote les seuils, pas
  // `reportCount`, qui est un cumul historique et ne redescend jamais.
  const openReports = await prisma.report.count({
    where: { listingId, status: "OPEN" },
  });

  if (updatedListing.status === "APPROVED" && openReports >= AUTO_REMOVE_THRESHOLD) {
    // Retrait automatique. L'annonce part dans « Retirées » côté admin, avec
    // ses 21 jours habituels : l'auteur peut la corriger, l'administrateur
    // peut la remettre en ligne d'un clic si le signalement était concerté.
    await removeListing({
      listingId,
      reason:
        `Cette annonce a été signalée ${openReports} fois par des utilisateurs différents. ` +
        `Elle est retirée le temps d'une vérification. Si vous estimez que c'est une erreur, ` +
        `modifiez-la pour demander une nouvelle validation.`,
      actor: "system:reports",
    }).catch((err) => console.error("[reports] retrait automatique impossible:", err));

    await prisma.moderationEvent.create({
      data: {
        listingId,
        userId: listing.userId,
        actor: "system",
        action: "report_auto_removed",
        reason: `${openReports} signalements ouverts (seuil ${AUTO_REMOVE_THRESHOLD})`,
        flagsJson: JSON.stringify([{ category }]),
      } as any,
    }).catch(() => {});
  } else if (updatedListing.status === "APPROVED" && openReports >= ATTENTION_THRESHOLD) {
    // Ni retrait ni dépublication : l'annonce reste en ligne, elle passe
    // simplement devant dans la file. La décision appartient à un humain.
    await prisma.listing.update({
      where: { id: listingId },
      data: {
        adminNote: `[SIGNALEE] ${openReports} signalements ouverts`,
        reviewPriority: Math.min(50, 7 + openReports),
      } as any,
    }).catch(() => {});

    await prisma.moderationEvent.create({
      data: {
        listingId,
        userId: listing.userId,
        actor: "system",
        action: "report_flagged",
        reason: `${openReports} signalements ouverts`,
        flagsJson: JSON.stringify([{ category }]),
      } as any,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

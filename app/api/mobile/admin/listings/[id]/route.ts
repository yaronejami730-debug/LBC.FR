import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminErrorResponse, requireMobileAdmin } from "@/lib/admin/mobile-guard";
import { approveListingCore, rejectListingCore } from "@/lib/moderation/listing-decisions";
import { CATEGORIES } from "@/lib/categories";
import { indexListing } from "@/lib/opensearch-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Décision de modération sur une annonce, depuis le téléphone.
 *
 * Les conséquences sont exactement celles du site : c'est le même code de
 * décision, appelé avec un jeton mobile au lieu d'un cookie de session. Une
 * annonce validée depuis un quai de gare envoie donc l'email, la notification
 * et repasse en indexation comme si le clic venait du bureau.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireMobileAdmin(req);
    const { id } = await ctx.params;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action ?? "");

    const listing = await prisma.listing.findUnique({ where: { id }, select: { id: true } });
    if (!listing) return NextResponse.json({ error: "Annonce introuvable." }, { status: 404 });

    if (action === "approve") {
      await approveListingCore(id);
      await trace(id, admin.id, "admin_approve", "Validée depuis l'application mobile");
      return NextResponse.json({ ok: true, status: "APPROVED" });
    }

    if (action === "reject") {
      const reason = String(body.reason ?? "").trim();
      if (reason.length < 3) {
        return NextResponse.json({ error: "Motif requis." }, { status: 400 });
      }
      await rejectListingCore(id, reason);
      await trace(id, admin.id, "admin_reject", reason.slice(0, 500));
      return NextResponse.json({ ok: true, status: "REJECTED" });
    }

    if (action === "recategorize") {
      const category = String(body.category ?? "");
      const target = CATEGORIES.find((c) => c.id === category);
      if (!target) return NextResponse.json({ error: "Catégorie inconnue." }, { status: 400 });
      const rawSub = body.subcategory ? String(body.subcategory) : null;
      const subcategory = rawSub && target.subcategories.includes(rawSub) ? rawSub : null;

      const updated = await prisma.listing.update({
        where: { id },
        data: { category: target.id, subcategory },
      });
      indexListing(updated).catch(() => {});
      await trace(
        id,
        admin.id,
        "listing_recategorized",
        `→ ${target.id}${subcategory ? ` / ${subcategory}` : ""}`,
      );
      return NextResponse.json({ ok: true, category: target.id, subcategory });
    }

    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

async function trace(listingId: string, adminId: string, action: string, reason: string) {
  await prisma.moderationEvent
    .create({ data: { listingId, actor: `admin:${adminId}`, action, reason } as never })
    .catch(() => {});
}

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const role = (session.user as { role?: string }).role;
  if (role === "ADMIN") return session.user.id;
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  return dbUser?.role === "ADMIN" ? session.user.id : null;
}

/**
 * Modification d'un annonceur, et suspension.
 *
 * Suspendre ne supprime rien : les campagnes, les dépenses et les factures
 * restent. Seul l'accès est coupé, et il se rouvre d'un clic — un impayé se
 * régularise, un compte supprimé ne se répare pas.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const existing = await prisma.advertiser.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Annonceur introuvable" }, { status: 404 });

  const text = (v: unknown, max: number) =>
    v === undefined ? undefined : String(v ?? "").trim().slice(0, max) || null;

  const advertiser = await prisma.advertiser.update({
    where: { id },
    data: {
      ...(body.firstName !== undefined && { firstName: String(body.firstName).trim().slice(0, 80) }),
      ...(body.lastName !== undefined && { lastName: String(body.lastName).trim().slice(0, 80) }),
      ...(text(body.phone, 30) !== undefined && { phone: text(body.phone, 30) }),
      ...(text(body.company, 120) !== undefined && { company: text(body.company, 120) }),
      ...(text(body.siret, 20) !== undefined && { siret: text(body.siret, 20) }),
      ...(text(body.addressLine, 200) !== undefined && { addressLine: text(body.addressLine, 200) }),
      ...(text(body.city, 100) !== undefined && { city: text(body.city, 100) }),
      ...(text(body.postalCode, 10) !== undefined && { postalCode: text(body.postalCode, 10) }),
      ...(body.suspended !== undefined && {
        suspendedAt: body.suspended === true ? new Date() : null,
      }),
    },
    select: { id: true, suspendedAt: true },
  });

  return NextResponse.json({ advertiser });
}

import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdvertiserError, createAdvertiser } from "@/lib/ads/advertiser-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Contrôle d'accès admin, même forme que les autres routes `/api/admin/*`. */
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

/** Liste des annonceurs, pour l'écran d'administration. */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const advertisers = await prisma.advertiser.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      company: true,
      siret: true,
      loginId: true,
      mustChangePassword: true,
      suspendedAt: true,
      balanceCents: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ advertisers });
}

/**
 * Crée un annonceur et lui envoie ses accès.
 *
 * Le mot de passe temporaire n'est renvoyé qu'ici, une seule fois : l'écran
 * l'affiche pour être recopié, la base n'en garde que l'empreinte.
 */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    const { advertiser, loginId, password, sent } = await createAdvertiser({
      firstName: String(body.firstName ?? ""),
      lastName: String(body.lastName ?? ""),
      email: String(body.email ?? ""),
      phone: body.phone ? String(body.phone) : null,
      company: body.company ? String(body.company) : null,
      // Facultatif, et il doit le rester : exiger un SIRET fermerait la porte
      // à un artisan qui veut trois bannières.
      siret: body.siret ? String(body.siret) : null,
      addressLine: body.addressLine ? String(body.addressLine) : null,
      city: body.city ? String(body.city) : null,
      postalCode: body.postalCode ? String(body.postalCode) : null,
      leadId: body.leadId ? String(body.leadId) : null,
    });

    return NextResponse.json(
      {
        advertiser: { id: advertiser.id, email: advertiser.email, company: advertiser.company },
        credentials: { loginId, password },
        sent,
        notice: sent
          ? `Accès envoyés à ${advertiser.email}. Notez-les : le mot de passe ne sera plus affiché.`
          : "Compte créé, mais l'e-mail n'est pas parti. Transmettez ces accès à la main.",
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof AdvertiserError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/advertisers] création impossible", e);
    return NextResponse.json({ error: "Création impossible pour le moment." }, { status: 500 });
  }
}

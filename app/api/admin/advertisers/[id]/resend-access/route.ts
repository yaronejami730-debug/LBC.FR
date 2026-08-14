import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdvertiserError, resendAdvertiserAccess } from "@/lib/ads/advertiser-admin";

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
 * Renvoie les accès : nouvel mot de passe temporaire, même identifiant.
 *
 * L'ancien mot de passe n'est jamais réaffiché — la base n'en a que
 * l'empreinte. « Renvoyer », c'est donc forcément « régénérer », et l'ancien
 * cesse de fonctionner sur-le-champ.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await ctx.params;
  try {
    const { loginId, password, sent } = await resendAdvertiserAccess(id);
    return NextResponse.json({
      credentials: { loginId, password },
      sent,
      notice: sent
        ? "Nouveaux accès envoyés. L'ancien mot de passe ne fonctionne plus."
        : "Mot de passe régénéré, mais l'e-mail n'est pas parti. Transmettez-le à la main.",
    });
  } catch (e) {
    if (e instanceof AdvertiserError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/advertisers] renvoi impossible", e);
    return NextResponse.json({ error: "Renvoi impossible pour le moment." }, { status: 500 });
  }
}

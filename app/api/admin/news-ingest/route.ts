import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attachAuthors, ingestAll, purgeOldNews } from "@/lib/news/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

/**
 * Captation immédiate, déclenchée à la main depuis `/admin/veille`.
 *
 * Elle existe pour une raison précise : pouvoir **vérifier** que la chaîne
 * fonctionne, sans attendre le prochain passage du cron. On publie un article
 * chez le média, on appuie ici, il apparaît. Sans ce bouton, la seule preuve
 * disponible serait « attendez une heure et regardez ».
 *
 * C'est exactement le travail du cron horaire, ni plus ni moins : mêmes flux,
 * mêmes règles, même invalidation de cache.
 */
export async function POST() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const reports = await ingestAll();
  const authors = await attachAuthors();
  const purged = await purgeOldNews();
  revalidateTag("news");

  return NextResponse.json({
    ok: reports.every((r) => !r.error),
    durationMs: Date.now() - started,
    created: reports.reduce((n, r) => n + r.created, 0),
    updated: reports.reduce((n, r) => n + r.updated, 0),
    authors,
    purged,
    reports,
  });
}

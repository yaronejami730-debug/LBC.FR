import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Collecteur des violations de Content-Security-Policy.
 *
 * La CSP est posée en `Report-Only` : le navigateur n'empêche rien, il signale.
 * C'est la seule façon honnête de durcir une politique sur un site qui charge
 * AdSense, Google Analytics, Google Fonts, des cartes Google et les CDN d'une
 * dizaine d'agences — écrire les directives de mémoire puis passer en blocage
 * revient à casser la publicité ou les photos d'annonces sans s'en apercevoir.
 *
 * On collecte donc d'abord le réel, puis on resserre sur données.
 *
 * L'agrégat vit en mémoire, pas en base : c'est un outil de mise au point qui
 * servira quelques jours, pas une donnée métier. Redémarrer le serveur le
 * remet à zéro, et c'est très bien.
 */

type Violation = {
  directive: string;
  blockedHost: string;
  documentPath: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
};

/** Clé : `directive|hôte bloqué`. Borné pour ne pas gonfler indéfiniment. */
const violations = new Map<string, Violation>();
const MAX_KEYS = 500;

export async function POST(req: NextRequest) {
  // Un navigateur peut signaler des centaines de fois la même violation sur
  // une seule page. On borne par IP pour que le collecteur ne devienne pas
  // lui-même le problème.
  if (!rateLimit(`csp-report:${getClientIp(req)}`, 60, 60_000)) {
    return new NextResponse(null, { status: 204 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return new NextResponse(null, { status: 204 });

  // Deux formats coexistent : `report-uri` (objet `csp-report`) et
  // `report-to` (tableau d'objets `body`). On accepte les deux.
  const reports = Array.isArray(body)
    ? body.map((r) => r?.body ?? {})
    : [body["csp-report"] ?? body];

  for (const r of reports) {
    const directive = String(r?.["effective-directive"] ?? r?.effectiveDirective ?? r?.["violated-directive"] ?? "inconnu");
    const blockedRaw = String(r?.["blocked-uri"] ?? r?.blockedURL ?? "");
    const docRaw = String(r?.["document-uri"] ?? r?.documentURL ?? "");
    if (!directive) continue;

    const key = `${directive}|${hostOf(blockedRaw)}`;
    const now = new Date().toISOString();
    const existing = violations.get(key);

    if (existing) {
      existing.count++;
      existing.lastSeen = now;
    } else if (violations.size < MAX_KEYS) {
      violations.set(key, {
        directive,
        blockedHost: hostOf(blockedRaw),
        documentPath: pathOf(docRaw),
        count: 1,
        firstSeen: now,
        lastSeen: now,
      });
    }
  }

  // 204 : le navigateur n'attend pas de corps, et ne doit pas réessayer.
  return new NextResponse(null, { status: 204 });
}

/** Lecture de l'agrégat — réservée aux administrateurs. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN") {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (dbUser?.role !== "ADMIN") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  }

  const rows = [...violations.values()].sort((a, b) => b.count - a.count);
  return NextResponse.json({
    total: rows.reduce((sum, r) => sum + r.count, 0),
    distinct: rows.length,
    truncated: violations.size >= MAX_KEYS,
    violations: rows,
  });
}

/**
 * Seul l'hôte est retenu, jamais l'URL complète.
 *
 * Une URL bloquée peut porter un identifiant de session ou un jeton dans sa
 * query : les regrouper par hôte suffit à décider d'une directive, et évite de
 * constituer un journal de données personnelles.
 */
function hostOf(raw: string): string {
  if (!raw || raw === "inline" || raw === "eval" || raw === "data") return raw || "(vide)";
  try {
    return new URL(raw).hostname;
  } catch {
    return raw.slice(0, 60);
  }
}

function pathOf(raw: string): string {
  try {
    return new URL(raw).pathname;
  } catch {
    return "/";
  }
}

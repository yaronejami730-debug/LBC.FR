/**
 * Endpoint d'ingestion d'événements utilisateur. Insertion par lots.
 * L'authentification est optionnelle : si l'utilisateur est connecté on
 * attache `userId`, sinon seul `sessionId` (sessionStorage `dealco_uid`)
 * identifie l'origine.
 *
 * Plafonds : 50 events / requête, kind ≤ 64 c., path ≤ 500 c., meta ≤ 4 ko.
 * Aucune erreur n'est remontée au client — le tracking ne doit jamais casser
 * l'expérience utilisateur.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_EVENTS = 50;
const MAX_KIND = 64;
const MAX_PATH = 500;
const MAX_META = 4_000;
const MAX_SESSION_ID = 64;

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true, count: 0 });
  }

  const events = Array.isArray(body?.events) ? body.events.slice(0, MAX_EVENTS) : [];
  if (events.length === 0) return NextResponse.json({ ok: true, count: 0 });

  const session = await auth();
  const userId = (session?.user?.id as string | undefined) ?? null;

  const rows = events
    .filter(
      (e: any) =>
        e && typeof e.kind === "string" && e.kind.length > 0 && e.kind.length <= MAX_KIND,
    )
    .map((e: any) => ({
      userId,
      sessionId:
        typeof e.sessionId === "string" ? e.sessionId.slice(0, MAX_SESSION_ID) : null,
      kind: e.kind.slice(0, MAX_KIND),
      path: typeof e.path === "string" ? e.path.slice(0, MAX_PATH) : null,
      meta: e.meta ? JSON.stringify(e.meta).slice(0, MAX_META) : null,
    }));

  if (rows.length > 0) {
    await prisma.userEvent.createMany({ data: rows }).catch((err) => {
      console.error("[UserEvent] insertion échec:", err);
    });
  }
  return NextResponse.json({ ok: true, count: rows.length });
}

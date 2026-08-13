import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const { email, citySlug, categoryId, subcategorySlug, source, query } = body ?? {};

  if (typeof email !== "string") {
    return NextResponse.json({ error: "Email manquant" }, { status: 400 });
  }
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 200) ?? null;
  const wantedQuery =
    typeof query === "string" && query.trim() ? query.trim().slice(0, 120).toLowerCase() : null;

  /**
   * Demande nommée (page de cote) : la clé d'unicité de la table ne la connaît
   * pas — elle porte sur catégorie / ville / sous-catégorie, toutes nulles ici.
   * Deux modèles différents demandés par la même adresse partageraient donc la
   * même clé, et le second écraserait le premier.
   *
   * On dédoublonne explicitement sur (email, query) et on insère. Le chemin
   * historique, lui, n'est pas touché.
   */
  if (wantedQuery) {
    try {
      const already = await prisma.waitlist.findFirst({
        where: { email: normalized, query: wantedQuery } as any,
        select: { id: true },
      });
      if (!already) {
        await prisma.waitlist.create({
          data: {
            email: normalized,
            query: wantedQuery,
            source: typeof source === "string" ? source.slice(0, 100) : "prix",
            userAgent,
          } as any,
        });
      }
    } catch (err) {
      console.error("waitlist query insert error", err);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  try {
    await prisma.waitlist.upsert({
      where: {
        email_categoryId_citySlug_subcategorySlug: {
          email: normalized,
          categoryId: typeof categoryId === "string" ? categoryId : "",
          citySlug: typeof citySlug === "string" ? citySlug : "",
          subcategorySlug: typeof subcategorySlug === "string" ? subcategorySlug : "",
        } as any,
      },
      create: {
        email: normalized,
        citySlug: typeof citySlug === "string" && citySlug ? citySlug : null,
        categoryId: typeof categoryId === "string" && categoryId ? categoryId : null,
        subcategorySlug: typeof subcategorySlug === "string" && subcategorySlug ? subcategorySlug : null,
        source: typeof source === "string" ? source.slice(0, 100) : null,
        userAgent,
      },
      update: {},
    });
  } catch (err) {
    console.error("waitlist upsert error", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

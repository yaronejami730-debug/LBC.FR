import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const { email, citySlug, categoryId, subcategorySlug, source } = body ?? {};

  if (typeof email !== "string") {
    return NextResponse.json({ error: "Email manquant" }, { status: 400 });
  }
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 200) ?? null;

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

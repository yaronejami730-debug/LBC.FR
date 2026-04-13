import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/ads/activate  { id, action: "activate" | "deactivate" }
export async function POST(req: NextRequest) {
  const { id, action } = await req.json();
  if (!id || (action !== "activate" && action !== "deactivate")) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }
  await prisma.$executeRaw`
    UPDATE "Advertisement"
    SET "isActive" = ${action === "activate"}
    WHERE id = ${id}
  `;
  return NextResponse.json({ ok: true });
}

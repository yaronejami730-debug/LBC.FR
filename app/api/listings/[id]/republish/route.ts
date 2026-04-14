import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const listing = await prisma.listing.findUnique({ where: { id } });

  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (listing.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.listing.update({
    where: { id },
    data: {
      createdAt: new Date(),
      expiryNotifiedAt: null,
      status: "APPROVED",
    },
  });

  return NextResponse.json({ ok: true });
}

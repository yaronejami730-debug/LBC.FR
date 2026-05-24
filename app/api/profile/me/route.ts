import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, name: true, role: true, isPro: true, emailVerified: true,
      companyName: true, verified: true, avatar: true, phoneNumber: true, marketingConsent: true,
      civility: true, firstName: true, lastName: true, birthDate: true,
      addressLine: true, addressCity: true, addressPostal: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

  return NextResponse.json({
    user: {
      ...user,
      birthDate: user.birthDate ? user.birthDate.toISOString() : null,
    },
  });
}

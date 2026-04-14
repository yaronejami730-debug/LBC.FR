import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { reengagementEmail } from "@/lib/emails/reengagement";

const DAYS_30 = 30 * 24 * 60 * 60 * 1000;
const DAYS_7  =  7 * 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const cutoff30 = new Date(now.getTime() - DAYS_30);
  const cutoff7  = new Date(now.getTime() - DAYS_7);

  // Utilisateurs inactifs depuis 30j ET (jamais relancé OU relancé il y a +7j)
  const inactiveUsers = await prisma.user.findMany({
    where: {
      role: "USER",
      OR: [
        { lastLoginAt: { lte: cutoff30 } },
        { lastLoginAt: null, createdAt: { lte: cutoff30 } },
      ],
      AND: [
        {
          OR: [
            { reengagementSentAt: null },
            { reengagementSentAt: { lte: cutoff7 } },
          ],
        },
      ],
    },
    select: { id: true, name: true, email: true },
    take: 100,
  });

  // Compter les nouvelles annonces des 30 derniers jours
  const newListingsCount = await prisma.listing.count({
    where: {
      status: "APPROVED",
      createdAt: { gte: cutoff30 },
    },
  });

  let sent = 0;
  for (const user of inactiveUsers) {
    await sendEmail({
      to: user.email,
      toName: user.name,
      subject: `${newListingsCount} nouvelles annonces vous attendent — Deal & Co`,
      html: reengagementEmail({ name: user.name, newListingsCount }),
    }).catch(() => {});

    await prisma.user.update({
      where: { id: user.id },
      data: { reengagementSentAt: now },
    });
    sent++;
  }

  return NextResponse.json({ sent, newListingsCount });
}

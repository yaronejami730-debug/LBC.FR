import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushNotification } from "@/lib/notifications/send";

// Envoie un push de test à l'admin connecté (via ses propres tokens Expo).
// Renvoie { sent: number, hasToken: boolean, error?: string }.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN") {
    const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
    if (dbUser?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const tokens = await prisma.expoPushToken.count({
    where: { userId: session.user.id, disabledAt: null },
  });
  if (tokens === 0) {
    return NextResponse.json({
      sent: 0,
      hasToken: false,
      error: "Aucun appareil enregistré sur ce compte. Connectez-vous d'abord sur l'app mobile.",
    });
  }

  try {
    await sendPushNotification({
      userId: session.user.id,
      template: "welcome",
      variables: {},
    });
    return NextResponse.json({ sent: tokens, hasToken: true });
  } catch (e) {
    return NextResponse.json({
      sent: 0,
      hasToken: true,
      error: e instanceof Error ? e.message : "Échec de l'envoi",
    }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteProDocuments, DOCUMENT_RETENTION_MONTHS } from "@/lib/pro-documents";
import { sendEmail } from "@/lib/email";
import { proDocumentsPurgedEmail } from "@/lib/emails/pro-verification";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Effacement des pièces des dossiers dormants.
 *
 * Un dossier refusé ou en attente de complément garde ses pièces : le compte
 * peut contester ou compléter, et le modérateur doit pouvoir s'y référer. Mais
 * si rien ne bouge pendant DOCUMENT_RETENTION_MONTHS mois, plus rien ne
 * justifie de conserver une carte d'identité — elle est supprimée du stockage
 * et son chemin neutralisé.
 *
 * Les dossiers approuvés ne passent pas par ici : leurs pièces sont déjà
 * détruites au moment de la décision.
 */
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expected = process.env.CRON_SECRET;
  if (!expected || (secret !== expected && bearer !== expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - DOCUMENT_RETENTION_MONTHS);

  // « Dormant » se mesure à la dernière trace d'activité du dossier : sa
  // décision si elle existe, son dépôt sinon.
  const dossiers = await prisma.proVerification.findMany({
    where: {
      documentsDeletedAt: null,
      status: { in: ["REJECTED", "INFO_REQUESTED", "PENDING", "SUSPENDED"] },
      AND: [
        { OR: [{ rejectedAt: null }, { rejectedAt: { lte: cutoff } }] },
        { OR: [{ suspendedAt: null }, { suspendedAt: { lte: cutoff } }] },
        { submittedAt: { lte: cutoff } },
      ],
    },
    select: {
      id: true,
      status: true,
      userId: true,
      user: { select: { email: true, name: true } },
    },
    take: 200,
  });

  let purged = 0;
  for (const d of dossiers) {
    // Un dossier repris entre-temps a des lignes d'historique récentes : on ne
    // touche pas à un dossier encore vivant.
    const recentActivity = await prisma.proVerificationLog.count({
      where: { verificationId: d.id, createdAt: { gt: cutoff } },
    });
    if (recentActivity > 0) continue;

    const done = await deleteProDocuments(
      d.id,
      "cron:pro-documents-purge",
      `Dossier ${d.status} sans activité depuis ${DOCUMENT_RETENTION_MONTHS} mois`,
    );
    if (!done) continue;
    purged++;

    // L'utilisateur doit savoir que ses pièces ont disparu : sans nouveau
    // dépôt, son compte professionnel ne sera jamais activé.
    if (d.user?.email) {
      await sendEmail({
        to: d.user.email,
        toName: d.user.name,
        subject: "Vos justificatifs professionnels ont été supprimés",
        html: proDocumentsPurgedEmail({
          name: d.user.name ?? "",
          months: DOCUMENT_RETENTION_MONTHS,
        }),
      }).catch((err) => console.error("[pro-documents-purge] email:", err));
    }
  }

  return NextResponse.json({ purged, examined: dossiers.length });
}

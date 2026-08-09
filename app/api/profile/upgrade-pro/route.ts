import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { proVerificationSubmittedEmail } from "@/lib/emails/pro-verification";

const ID_TYPES = new Set(["CNI", "PASSEPORT", "TITRE_SEJOUR"]);
const COMPANY_DOC_TYPES = new Set(["KBIS", "AVIS_SIRENE"]);

/**
 * Demande de passage en compte professionnel.
 *
 * Le compte n'est **pas** activé ici : la route enregistre un dossier en
 * attente. Le SIRET seul ne prouve rien — il est public, et des comptes se
 * déclaraient pro avec le SIRET d'une entreprise tierce. `isPro` ne bascule
 * qu'à l'approbation d'un modérateur (app/admin/(protected)/verifications-pro).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    siret,
    companyName,
    idDocumentType,
    idDocumentPath,
    companyDocType,
    companyDocPath,
  } = await req.json().catch(() => ({}));

  if (!siret || !companyName) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }
  if (!idDocumentPath || !ID_TYPES.has(idDocumentType)) {
    return NextResponse.json({ error: "Pièce d'identité manquante" }, { status: 400 });
  }
  if (!companyDocPath || !COMPANY_DOC_TYPES.has(companyDocType)) {
    return NextResponse.json({ error: "Justificatif d'entreprise manquant" }, { status: 400 });
  }

  // Les fichiers déposés le sont sous kyc/<userId>/ : refuser tout autre
  // chemin empêche de rattacher à son dossier le document d'un autre compte.
  const prefix = `kyc/${session.user.id}/`;
  if (!String(idDocumentPath).startsWith(prefix) || !String(companyDocPath).startsWith(prefix)) {
    return NextResponse.json({ error: "Documents invalides" }, { status: 400 });
  }

  const existingSiret = await prisma.user.findUnique({ where: { siret } });
  if (existingSiret && existingSiret.id !== session.user.id) {
    return NextResponse.json({ error: "Ce SIRET est déjà associé à un compte" }, { status: 409 });
  }

  const pending = await prisma.proVerification.findFirst({
    where: { userId: session.user.id, status: "PENDING" },
    select: { id: true },
  });
  if (pending) {
    return NextResponse.json(
      { error: "Une demande est déjà en cours d'examen" },
      { status: 409 },
    );
  }

  await prisma.proVerification.create({
    data: {
      userId: session.user.id,
      siret: String(siret).replace(/\s/g, "").slice(0, 14),
      companyName: String(companyName).slice(0, 200),
      idDocumentType,
      idDocumentPath,
      companyDocType,
      companyDocPath,
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true },
  });

  if (user?.email) {
    await sendEmail({
      to: user.email,
      subject: "Votre demande de compte professionnel est en cours d'examen",
      html: proVerificationSubmittedEmail({ name: user.name ?? "", companyName }),
    }).catch((err) => console.error("[upgrade-pro] email:", err));
  }

  const adminTo = process.env.ADMIN_EMAIL;
  if (adminTo) {
    await sendEmail({
      to: adminTo,
      subject: `Vérification pro à traiter — ${companyName}`,
      html: `<p>Nouvelle demande de compte professionnel.</p>
             <p><strong>${companyName}</strong> — SIRET ${siret}<br/>
             Compte : ${user?.email ?? session.user.id}</p>
             <p><a href="https://www.dealandcompany.fr/admin/verifications-pro">Ouvrir la file de vérification</a></p>`,
    }).catch((err) => console.error("[upgrade-pro] email admin:", err));
  }

  return NextResponse.json({ ok: true, status: "PENDING" });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { proVerificationSubmittedEmail } from "@/lib/emails/pro-verification";
import { notifyAdmins } from "@/lib/expo-push";
import {
  siretFlaggedByBan,
  releaseSiretFromBannedAccounts,
} from "@/lib/moderation/ban-registry";

const ID_TYPES = new Set(["CNI", "PASSEPORT", "TITRE_SEJOUR"]);
const COMPANY_DOC_TYPES = new Set(["KBIS", "AVIS_SIRENE"]);
const REQUEST_TYPES = new Set(["DIRECT_PROFESSIONAL", "CONVERT_FROM_PRIVATE"]);

/**
 * Demande d'habilitation professionnelle.
 *
 * Le compte n'est **pas** activé ici, et rien de ce qu'il pouvait faire ne lui
 * est retiré : il reste un compte particulier pleinement utilisable pendant
 * toute l'instruction. Un SIRET est public — il ne prouve rien. Seul un
 * modérateur fait passer `professionalStatus` à APPROVED, depuis
 * /admin/verifications-pro.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const siret = String(b.siret ?? "").replace(/\s/g, "").slice(0, 14);
  const companyName = String(b.companyName ?? "").trim();

  if (!siret || !companyName) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }
  if (!b.idDocumentPath || !ID_TYPES.has(b.idDocumentType)) {
    return NextResponse.json({ error: "Pièce d'identité manquante" }, { status: 400 });
  }
  if (!b.companyDocPath || !COMPANY_DOC_TYPES.has(b.companyDocType)) {
    return NextResponse.json({ error: "Justificatif d'entreprise manquant" }, { status: 400 });
  }

  // Les fichiers déposés le sont sous kyc/<userId>/ : refuser tout autre
  // chemin empêche de rattacher à sa demande le document d'un autre utilisateur.
  const prefix = `kyc/${session.user.id}/`;
  if (!String(b.idDocumentPath).startsWith(prefix) || !String(b.companyDocPath).startsWith(prefix)) {
    return NextResponse.json({ error: "Documents invalides" }, { status: 400 });
  }

  // Un compte banni ne garde pas la main sur un identifiant public qu'il n'a
  // jamais prouvé sien : on le détache avant de tester le conflit, sinon
  // l'usurpateur aurait confisqué à l'entreprise réelle sa propre identité.
  await releaseSiretFromBannedAccounts(siret).catch((err) =>
    console.error("[upgrade-pro] libération SIRET:", err),
  );

  const existingSiret = await prisma.user.findUnique({ where: { siret } });
  if (existingSiret && existingSiret.id !== session.user.id) {
    return NextResponse.json({ error: "Ce SIRET est déjà associé à un compte" }, { status: 409 });
  }

  // Signal, pas verdict : le dossier passe en examen attentif, il n'est pas
  // refusé. C'est le Kbis qui tranchera à qui ce SIRET appartient vraiment.
  const siretPreviouslyBanned = await siretFlaggedByBan(siret).catch(() => false);

  const openRequest = await prisma.proVerification.findFirst({
    where: { userId: session.user.id, status: { in: ["PENDING", "INFO_REQUESTED"] } },
    select: { id: true },
  });
  if (openRequest) {
    return NextResponse.json({ error: "Une demande est déjà en cours d'examen" }, { status: 409 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, isPro: true },
  });

  // Un compte déjà professionnel qui renvoie une demande ne perd pas ses
  // droits : il n'y a que deux origines possibles pour une demande.
  const requestType = REQUEST_TYPES.has(b.requestType)
    ? b.requestType
    : user?.isPro
      ? "DIRECT_PROFESSIONAL"
      : "CONVERT_FROM_PRIVATE";

  const str = (v: unknown, max: number) => (v ? String(v).trim().slice(0, max) : null);

  const demande = await prisma.proVerification.create({
    data: {
      userId: session.user.id,
      status: "PENDING",
      requestType,
      siret,
      siretPreviouslyBanned,
      siren: str(b.siren, 9) ?? siret.slice(0, 9),
      companyName: companyName.slice(0, 200),
      commercialName: str(b.commercialName, 200),
      businessAddress: str(b.businessAddress, 300),
      businessActivity: str(b.businessActivity, 200),
      businessCategory: str(b.businessCategory, 100),
      responsibleFirstName: str(b.responsibleFirstName, 100),
      responsibleLastName: str(b.responsibleLastName, 100),
      professionalPhone: str(b.professionalPhone, 30),
      professionalEmail: str(b.professionalEmail, 200),
      idDocumentType: b.idDocumentType,
      idDocumentPath: b.idDocumentPath,
      idDocumentBackPath:
        typeof b.idDocumentBackPath === "string" && b.idDocumentBackPath.startsWith(prefix)
          ? b.idDocumentBackPath
          : null,
      companyDocType: b.companyDocType,
      companyDocPath: b.companyDocPath,
    },
  });

  // Alerte les appareils passés en mode administrateur : un dossier
  // professionnel qui attend est un professionnel qui ne peut ni publier sa
  // fiche ni recevoir de réservation.
  notifyAdmins({
    title: "Dossier professionnel à vérifier",
    body: `${companyName} — SIRET ${siret}${siretPreviouslyBanned ? " ⚠ déjà vu sur un compte banni" : ""}`,
    data: { type: "admin_pro_pending", verificationId: demande.id },
  }).catch(() => {});

  await prisma.proVerificationLog.create({
    data: {
      verificationId: demande.id,
      action: "SUBMITTED",
      actor: `user:${session.user.id}`,
      details:
        `${requestType} — ${companyName} (SIRET ${siret})` +
        (siretPreviouslyBanned
          ? " — ⚠ SIRET déjà vu sur un compte banni : vérifier que le Kbis correspond bien au demandeur"
          : ""),
    },
  });

  // Le statut d'habilitation avance ; `isPro` ne bouge pas. Le compte
  // particulier continue exactement comme avant.
  await prisma.user.update({
    where: { id: session.user.id },
    data: { professionalStatus: "PENDING" },
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
      html: `<p>Nouvelle demande de compte professionnel (${requestType}).</p>
             <p><strong>${companyName}</strong> — SIRET ${siret}<br/>
             Compte : ${user?.email ?? session.user.id}</p>
             <p><a href="https://www.dealandcompany.fr/admin/verifications-pro">Ouvrir la file de vérification</a></p>`,
    }).catch((err) => console.error("[upgrade-pro] email admin:", err));
  }

  return NextResponse.json({ ok: true, status: "PENDING" });
}

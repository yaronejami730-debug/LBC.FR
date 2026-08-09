import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

/**
 * Cycle de vie des pièces justificatives d'un compte professionnel.
 *
 * Une carte d'identité et un Kbis ne servent qu'à une chose : permettre à un
 * modérateur de vérifier qu'un SIRET appartient bien à celui qui le déclare.
 * Passée cette vérification, les conserver n'apporte plus rien et fait courir
 * un risque. D'où trois règles :
 *
 * - **Habilitation accordée** → suppression immédiate. Le contrôle a eu lieu,
 *   la preuve n'a plus d'objet.
 * - **Refus, demande de complément, suspension** → conservation. Le dossier
 *   peut être contesté ou repris, et le modérateur doit pouvoir se référer aux
 *   pièces réellement fournies.
 * - **Dossier laissé en l'état** → suppression automatique au bout de 14 mois
 *   (cf. /api/cron/pro-documents-purge). Si le compte n'a rien régularisé en
 *   plus d'un an, la conservation n'est plus justifiable.
 *
 * Ces documents ne sont jamais visibles des utilisateurs, ni du titulaire du
 * compte : ils sont stockés en blob privé, sans URL publique, et ne se lisent
 * que par une route qui exige le rôle ADMIN.
 */

/** Délai au-delà duquel un dossier dormant perd ses pièces. */
export const DOCUMENT_RETENTION_MONTHS = 14;

/**
 * Efface les deux pièces d'un dossier et neutralise leurs chemins.
 *
 * Les colonnes ne peuvent pas être nulles (elles décrivent ce qui *a* été
 * fourni) : on y écrit un marqueur, qui empêche toute tentative de lecture
 * ultérieure tout en gardant trace du type de document présenté.
 */
export async function deleteProDocuments(
  verificationId: string,
  actor: string,
  reason: string,
): Promise<boolean> {
  const dossier = await prisma.proVerification.findUnique({
    where: { id: verificationId },
    select: { idDocumentPath: true, companyDocPath: true, documentsDeletedAt: true },
  });
  if (!dossier || dossier.documentsDeletedAt) return false;

  const paths = [dossier.idDocumentPath, dossier.companyDocPath].filter(
    (p) => p && !p.startsWith("deleted:"),
  );

  if (paths.length > 0) {
    // Un échec de suppression côté stockage ne doit pas bloquer la décision de
    // modération : on neutralise malgré tout les chemins, et l'erreur est
    // journalisée pour reprise.
    await del(paths, { access: "private" }).catch((err) =>
      console.error("[pro-documents] suppression blob:", err),
    );
  }

  const now = new Date();
  await prisma.proVerification.update({
    where: { id: verificationId },
    data: {
      idDocumentPath: `deleted:${now.toISOString()}`,
      companyDocPath: `deleted:${now.toISOString()}`,
      documentsDeletedAt: now,
    },
  });

  await prisma.proVerificationLog.create({
    data: {
      verificationId,
      action: "DOCUMENTS_DELETED",
      actor,
      details: reason,
    },
  }).catch(() => {});

  return true;
}

/** Un chemin neutralisé ne désigne plus aucun fichier. */
export function documentsAvailable(path: string | null | undefined): boolean {
  return !!path && !path.startsWith("deleted:");
}

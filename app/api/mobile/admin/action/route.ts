import { NextResponse, type NextRequest } from "next/server";
import { AdminApiError, adminErrorResponse, requireMobileAdmin } from "@/lib/admin/mobile-guard";

import * as core from "@/app/admin/actions";
import * as securite from "@/app/admin/(protected)/securite/actions";
import * as pros from "@/app/admin/(protected)/professionnels/actions";
import * as verifs from "@/app/admin/(protected)/verifications-pro/actions";
import * as leads from "@/app/admin/(protected)/annonceurs/actions";
import * as reco from "@/app/admin/(protected)/recommandations/actions";
import * as support from "@/app/admin/(protected)/support/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pont entre l'administration mobile et celle du site.
 *
 * L'application ne peut pas appeler une Server Action : elle n'a ni cookie de
 * session ni protocole RSC. Plutôt que de réécrire chaque décision en REST —
 * et de la voir diverger au premier correctif — cette route appelle **les
 * fonctions exactes du site**. Une correction de la modération vaut donc
 * immédiatement pour les deux, sans rien à reporter.
 *
 * Chaque action porte déjà son propre `requireAdmin()`, désormais capable de
 * lire le jeton mobile. Le contrôle est refait ici pour que la liste blanche
 * ne soit même pas atteinte par un compte ordinaire.
 */
const ACTIONS = {
  // ── Annonces ────────────────────────────────────────────────────────────
  approveListing: core.approveListing,
  rejectListing: core.rejectListing,
  setListingCategory: core.setListingCategory,
  deleteListingByAdmin: core.deleteListingByAdmin,
  updateListingByAdmin: core.updateListingByAdmin,
  getClientListings: core.getClientListings,

  // ── Comptes ─────────────────────────────────────────────────────────────
  verifyUser: core.verifyUser,
  rejectUser: core.rejectUser,
  banUser: core.banUser,
  unbanUser: core.unbanUser,
  updateUserName: core.updateUserName,
  updateUserPhone: core.updateUserPhone,
  updateClientDisplayName: core.updateClientDisplayName,
  createClientAccount: core.createClientAccount,
  resendInvitation: core.resendInvitation,
  sendConsentReminderToUser: core.sendConsentReminderToUser,
  searchUsersForSourcePicker: core.searchUsersForSourcePicker,

  // ── Catégories ──────────────────────────────────────────────────────────
  getCategorySettings: core.getCategorySettings,
  updateCategoryApproval: core.updateCategoryApproval,

  // ── Publicités ──────────────────────────────────────────────────────────
  toggleAdStatus: core.toggleAdStatus,
  deleteAdvertisement: core.deleteAdvertisement,
  createAdvertisement: (fields: Record<string, string>) =>
    core.createAdvertisement(toFormData(fields)),
  updateAdvertisement: (id: string, fields: Record<string, string>) =>
    core.updateAdvertisement(id, toFormData(fields)),

  // ── Notifications ───────────────────────────────────────────────────────
  getCampaignCounts: core.getCampaignCounts,
  getPushAudienceCount: core.getPushAudienceCount,
  sendBroadcastPush: core.sendBroadcastPush,
  sendCampaignEmail: core.sendCampaignEmail,
  sendDiscoveryEmail: core.sendDiscoveryEmail,
  sendPitchBulk: core.sendPitchBulk,

  // ── Sources externes ────────────────────────────────────────────────────
  addExternalSource: (fields: Record<string, string>) =>
    core.addExternalSource(toFormData(fields)),
  runExternalSourceSync: core.runExternalSourceSync,
  toggleExternalSource: core.toggleExternalSource,
  deleteExternalSource: core.deleteExternalSource,
  importListingByUrl: core.importListingByUrl,

  // ── Centre de sécurité ──────────────────────────────────────────────────
  removeListingAction: securite.removeListingAction,
  keepListingOnlineAction: securite.keepListingOnlineAction,
  reviewListingAction: securite.reviewListingAction,
  restoreListingAction: securite.restoreListingAction,
  purgeListingAction: securite.purgeListingAction,
  watchAccountAction: securite.watchAccountAction,
  unwatchAccountAction: securite.unwatchAccountAction,
  banAccountAction: securite.banAccountAction,
  unbanAccountAction: securite.unbanAccountAction,
  purgeBannedAccountsAction: securite.purgeBannedAccountsAction,
  listBannedAccountIds: securite.listBannedAccountIds,

  // ── Professionnels ──────────────────────────────────────────────────────
  verifyProAccount: pros.verifyProAccount,
  requestProInfo: pros.requestProInfo,
  refuseProAccount: pros.refuseProAccount,
  suspendProAccount: pros.suspendProAccount,
  reinstateProAccount: pros.reinstateProAccount,
  deleteUserAccount: pros.deleteUserAccount,
  setVerificationBadge: pros.setVerificationBadge,
  setUserRole: pros.setUserRole,

  // ── Dossiers de vérification ────────────────────────────────────────────
  approveVerification: verifs.approveVerification,
  rejectVerification: verifs.rejectVerification,
  requestVerificationInfo: verifs.requestVerificationInfo,
  suspendVerification: verifs.suspendVerification,
  reinstateVerification: verifs.reinstateVerification,
  updateVerificationFields: verifs.updateVerificationFields,
  updateVerificationNote: verifs.updateVerificationNote,
  markCompteOpened: verifs.markCompteOpened,

  // ── Annonceurs ──────────────────────────────────────────────────────────
  updateLeadStatus: leads.updateLeadStatus,
  updateLeadNotes: leads.updateLeadNotes,
  deleteLead: leads.deleteLead,

  // ── Support client ──────────────────────────────────────────────────────
  replyToTicket: support.replyToTicket,
  setTicketStatus: support.setTicketStatus,
  assignTicket: support.assignTicket,
  setTicketPriority: support.setTicketPriority,
  markTicketRead: support.markTicketRead,

  // ── Recommandations ─────────────────────────────────────────────────────
  simulateCampaign: reco.simulateCampaign,
  refreshProfilesNow: reco.refreshProfilesNow,
} as const;

type ActionName = keyof typeof ACTIONS;

export async function POST(req: NextRequest) {
  try {
    await requireMobileAdmin(req);

    const body = (await req.json().catch(() => ({}))) as { name?: string; args?: unknown[] };
    const name = String(body.name ?? "") as ActionName;
    const fn = ACTIONS[name];
    if (!fn) return NextResponse.json({ error: `Action inconnue : ${name}` }, { status: 400 });

    const args = Array.isArray(body.args) ? body.args : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (fn as (...a: any[]) => Promise<unknown>)(...args);

    // Beaucoup d'actions ne renvoient rien : côté application, « pas de
    // résultat » et « échec » ne doivent pas se ressembler.
    return NextResponse.json({ ok: true, result: result ?? null });
  } catch (error) {
    // L'échec du verrou porte son propre code : 401 sans jeton, 403 pour un
    // compte ordinaire. Le confondre avec un refus métier ferait afficher
    // « requête invalide » à qui doit simplement se reconnecter.
    if (error instanceof AdminApiError) return adminErrorResponse(error);

    // Un refus métier (« Motif trop court », « Accès refusé ») est une réponse,
    // pas une panne : il doit s'afficher tel quel dans l'application.
    if (error instanceof Error && error.message && error.message.length < 200) {
      const status = /accès refusé/i.test(error.message) ? 403 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    return adminErrorResponse(error);
  }
}

/** Les actions de formulaire du site prennent un `FormData` : on le rebâtit. */
function toFormData(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields ?? {})) {
    if (value !== undefined && value !== null) form.append(key, String(value));
  }
  return form;
}

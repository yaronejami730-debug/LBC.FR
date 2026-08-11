import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { daysUntilDeletion, REMOVAL_RETENTION_DAYS } from "@/lib/moderation/removal";
import { TrustBadge, TrustGauge } from "./TrustGauge";
import {
  KeepOnlineButton,
  RemoveListingButton,
  RestoreListingButton,
  PurgeListingButton,
  WatchButton,
  UnwatchButton,
  BanButton,
  UnbanButton,
  PurgeBannedButton,
} from "./SecurityActions";

/**
 * Contenu des onglets du centre de sécurité.
 *
 * Chaque onglet est un composant serveur autonome : il lit ce dont il a besoin
 * et rien d'autre. C'est ce qui permet à la page de n'exécuter que les requêtes
 * de l'onglet affiché — un centre de sécurité qui charge six listes complètes
 * à chaque visite devient inutilisable dès que le site grossit.
 */

const CARD = "bg-white rounded-2xl border border-[#eceef0] overflow-hidden";
const TH = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500";
const TD = "px-4 py-3 text-sm text-slate-700 align-middle";

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(d: Date): string {
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-6 py-14 text-center text-slate-400 text-sm">{children}</p>;
}

/** Compte à rebours avant destruction — le rouge n'apparaît qu'à l'approche. */
function DeletionCountdown({ at }: { at: Date | null }) {
  const days = daysUntilDeletion(at);
  if (days === null) return <span className="text-slate-400">—</span>;
  const tone =
    days === 0 ? "text-rose-700 bg-rose-50" : days <= 5 ? "text-orange-700 bg-orange-50" : "text-slate-600 bg-slate-100";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${tone}`}>
      <span className="material-symbols-outlined text-[13px]">hourglass_bottom</span>
      {days === 0 ? "Suppression imminente" : `${days} j`}
    </span>
  );
}

function UserCell({
  user,
}: {
  user: { id: string; name: string; email: string; trustScore: number; isPro: boolean; companyName: string | null };
}) {
  const display = user.isPro && user.companyName ? user.companyName : user.name;
  return (
    <div className="min-w-0">
      <Link href={`/admin/clients/${user.id}`} className="font-bold text-slate-900 hover:text-[#2f6fb8] truncate block">
        {display}
      </Link>
      <p className="text-xs text-slate-400 truncate">{user.email}</p>
      <div className="mt-1">
        <TrustBadge score={user.trustScore} />
      </div>
    </div>
  );
}

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  trustScore: true,
  isPro: true,
  companyName: true,
} as const;

// ── Signalements ──────────────────────────────────────────────────────────────

export async function ReportsTab() {
  const reports = await prisma.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      category: true,
      message: true,
      createdAt: true,
      listing: {
        select: {
          id: true,
          title: true,
          category: true,
          status: true,
          reportCount: true,
          qualityScore: true,
          user: { select: USER_SELECT },
        },
      },
      subject: { select: USER_SELECT },
      reporter: { select: { id: true, name: true } },
    },
  });

  if (reports.length === 0) {
    return (
      <div className={CARD}>
        <Empty>Aucun signalement ouvert.</Empty>
      </div>
    );
  }

  return (
    <div className={CARD}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
        <thead className="bg-slate-50 border-b border-[#eceef0]">
          <tr>
            <th className={TH}>Contenu signalé</th>
            <th className={TH}>Compte</th>
            <th className={TH}>Motif</th>
            <th className={TH}>Date</th>
            <th className={`${TH} text-right`}>Décision</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f2f4f6]">
          {reports.map((r) => {
            const target = r.listing?.user ?? r.subject;
            return (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className={TD}>
                  {r.listing ? (
                    <>
                      <Link
                        href={`/annonce/${r.listing.id}`}
                        className="font-bold text-slate-900 hover:text-[#2f6fb8] line-clamp-1"
                      >
                        {r.listing.title}
                      </Link>
                      <p className="text-xs text-slate-400">
                        {r.listing.category} · qualité {r.listing.qualityScore}/100
                        {r.listing.reportCount > 1 && (
                          <span className="text-rose-600 font-bold"> · {r.listing.reportCount} signalements</span>
                        )}
                      </p>
                    </>
                  ) : (
                    <span className="text-slate-500 italic">Signalement de compte</span>
                  )}
                </td>
                <td className={TD}>{target ? <UserCell user={target} /> : "—"}</td>
                <td className={TD}>
                  <span className="inline-block px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[11px] font-bold uppercase tracking-wide">
                    {r.category}
                  </span>
                  {r.message && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{r.message}</p>}
                </td>
                <td className={`${TD} whitespace-nowrap text-slate-500`}>{fmtDateTime(r.createdAt)}</td>
                <td className={`${TD} text-right`}>
                  {/* Trois issues, dans l'ordre du plus fréquent au plus
                      grave : garder, retirer, bannir. */}
                  <div className="flex justify-end gap-2 flex-wrap">
                    {r.listing && <KeepOnlineButton listingId={r.listing.id} />}
                    {r.listing && r.listing.status !== "REMOVED" && (
                      <RemoveListingButton listingId={r.listing.id} />
                    )}
                    {target && <BanButton userId={target.id} userName={target.name} />}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// ── Annonces retirées ─────────────────────────────────────────────────────────

export async function RemovedListingsTab() {
  const listings = await prisma.listing.findMany({
    where: { status: "REMOVED" },
    orderBy: { permanentDeletionAt: "asc" },
    take: 150,
    select: {
      id: true,
      title: true,
      category: true,
      rejectionReason: true,
      removedAt: true,
      permanentDeletionAt: true,
      qualityScore: true,
      user: { select: USER_SELECT },
    },
  });

  if (listings.length === 0) {
    return (
      <div className={CARD}>
        <Empty>Aucune annonce retirée.</Empty>
      </div>
    );
  }

  return (
    <>
      <p className="text-xs text-slate-500 mb-3">
        Une annonce retirée est invisible publiquement. Son auteur dispose de {REMOVAL_RETENTION_DAYS} jours
        pour la corriger et la soumettre à nouveau ; passé ce délai elle est détruite automatiquement,
        avec ses photos.
      </p>
      <div className={CARD}>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead className="bg-slate-50 border-b border-[#eceef0]">
            <tr>
              <th className={TH}>Annonce</th>
              <th className={TH}>Compte</th>
              <th className={TH}>Motif du retrait</th>
              <th className={TH}>Retirée le</th>
              <th className={TH}>Suppression</th>
              <th className={`${TH} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f2f4f6]">
            {listings.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50/60">
                <td className={TD}>
                  <Link href={`/annonce/${l.id}`} className="font-bold text-slate-900 hover:text-[#2f6fb8] line-clamp-1">
                    {l.title}
                  </Link>
                  <p className="text-xs text-slate-400">
                    {l.category} · qualité {l.qualityScore}/100
                  </p>
                </td>
                <td className={TD}>
                  <UserCell user={l.user} />
                </td>
                <td className={`${TD} max-w-xs`}>
                  <span className="text-slate-600 line-clamp-2">{l.rejectionReason ?? "—"}</span>
                </td>
                <td className={`${TD} whitespace-nowrap text-slate-500`}>{fmtDate(l.removedAt)}</td>
                <td className={TD}>
                  <div className="flex flex-col gap-1">
                    <DeletionCountdown at={l.permanentDeletionAt} />
                    <span className="text-[11px] text-slate-400">{fmtDate(l.permanentDeletionAt)}</span>
                  </div>
                </td>
                <td className={`${TD} text-right`}>
                  <div className="flex justify-end gap-2 flex-wrap">
                    <RestoreListingButton listingId={l.id} />
                    <PurgeListingButton listingId={l.id} title={l.title} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </>
  );
}

// ── Annonces refusées ─────────────────────────────────────────────────────────

export async function RejectedListingsTab() {
  const listings = await prisma.listing.findMany({
    where: { status: "REJECTED" },
    orderBy: { updatedAt: "desc" },
    take: 150,
    select: {
      id: true,
      title: true,
      category: true,
      rejectionReason: true,
      updatedAt: true,
      permanentDeletionAt: true,
      qualityScore: true,
      riskScore: true,
      user: { select: USER_SELECT },
    },
  });

  if (listings.length === 0) {
    return (
      <div className={CARD}>
        <Empty>Aucune annonce refusée.</Empty>
      </div>
    );
  }

  return (
    <div className={CARD}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
        <thead className="bg-slate-50 border-b border-[#eceef0]">
          <tr>
            <th className={TH}>Annonce</th>
            <th className={TH}>Compte</th>
            <th className={TH}>Catégorie</th>
            <th className={TH}>Motif du refus</th>
            <th className={TH}>Date</th>
            <th className={TH}>Suppression</th>
            <th className={`${TH} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f2f4f6]">
          {listings.map((l) => (
            <tr key={l.id} className="hover:bg-slate-50/60">
              <td className={TD}>
                <Link href={`/annonce/${l.id}`} className="font-bold text-slate-900 hover:text-[#2f6fb8] line-clamp-1">
                  {l.title}
                </Link>
                <p className="text-xs text-slate-400">
                  qualité {l.qualityScore}/100 · risque {l.riskScore}/100
                </p>
              </td>
              <td className={TD}>
                <UserCell user={l.user} />
              </td>
              <td className={`${TD} text-slate-500`}>{l.category}</td>
              <td className={`${TD} max-w-xs`}>
                <span className="text-slate-600 line-clamp-2">{l.rejectionReason ?? "—"}</span>
              </td>
              <td className={`${TD} whitespace-nowrap text-slate-500`}>{fmtDate(l.updatedAt)}</td>
              <td className={TD}>
                {l.permanentDeletionAt ? (
                  <span className="text-[11px] text-slate-400">{fmtDate(l.permanentDeletionAt)}</span>
                ) : (
                  <span className="text-[11px] text-slate-400">Non programmée</span>
                )}
              </td>
              <td className={`${TD} text-right`}>
                <div className="flex justify-end gap-2 flex-wrap">
                  <RestoreListingButton listingId={l.id} />
                  <RemoveListingButton listingId={l.id} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// ── Comptes sous surveillance ─────────────────────────────────────────────────

/**
 * Deux populations dans le même onglet, et c'est voulu.
 *
 * Un compte peut être *marqué* par un modérateur, ou *remonté* par les signaux
 * automatiques (score de spam, signalements). Les séparer obligerait à
 * regarder deux listes pour la même question : « qui dois-je revoir ? ». La
 * colonne « Origine » dit lequel des deux, ce qui suffit.
 */
export async function WatchedAccountsTab() {
  const users = await prisma.user.findMany({
    where: {
      bannedAt: null,
      role: { not: "ADMIN" },
      OR: [
        { watchedAt: { not: null } },
        { spamScore: { gte: 20 } },
        { totalReportsAgainst: { gte: 2 } },
      ],
    },
    orderBy: [{ watchedAt: "desc" }, { trustScore: "asc" }],
    take: 150,
    select: {
      ...USER_SELECT,
      watchedAt: true,
      watchReason: true,
      watchedBy: true,
      spamScore: true,
      totalReportsAgainst: true,
      rejectedListingCount: true,
      restrictedAt: true,
      createdAt: true,
      phoneNumber: true,
      _count: { select: { listings: true } },
    },
  });

  if (users.length === 0) {
    return (
      <div className={CARD}>
        <Empty>Aucun compte à surveiller.</Empty>
      </div>
    );
  }

  return (
    <>
      <p className="text-xs text-slate-500 mb-3">
        Ces comptes ne sont pas sanctionnés : ils sont simplement à revoir. Aucune action n'est
        appliquée automatiquement — le score de confiance est une aide à la décision, pas une décision.
      </p>
      <div className={CARD}>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
          <thead className="bg-slate-50 border-b border-[#eceef0]">
            <tr>
              <th className={TH}>Compte</th>
              <th className={TH}>Confiance</th>
              <th className={TH}>Origine</th>
              <th className={TH}>Signaux</th>
              <th className={TH}>Inscrit le</th>
              <th className={`${TH} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f2f4f6]">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/60">
                <td className={TD}>
                  <Link href={`/admin/clients/${u.id}`} className="font-bold text-slate-900 hover:text-[#2f6fb8]">
                    {u.isPro && u.companyName ? u.companyName : u.name}
                  </Link>
                  <p className="text-xs text-slate-400">{u.email}</p>
                  {u.phoneNumber && <p className="text-xs text-slate-400">{u.phoneNumber}</p>}
                </td>
                <td className={`${TD} w-40`}>
                  <TrustGauge score={u.trustScore} size="sm" />
                </td>
                <td className={TD}>
                  {u.watchedAt ? (
                    <>
                      <span className="inline-block px-2 py-0.5 rounded-full bg-slate-800 text-white text-[11px] font-bold">
                        Marqué manuellement
                      </span>
                      {u.watchReason && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{u.watchReason}</p>}
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {u.watchedBy ?? "—"} · {fmtDate(u.watchedAt)}
                      </p>
                    </>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold">
                      Détection automatique
                    </span>
                  )}
                </td>
                <td className={`${TD} text-xs text-slate-500`}>
                  <ul className="space-y-0.5">
                    {u.totalReportsAgainst > 0 && <li>{u.totalReportsAgainst} signalement(s)</li>}
                    {u.rejectedListingCount > 0 && <li>{u.rejectedListingCount} annonce(s) refusée(s)</li>}
                    {u.spamScore >= 20 && <li>score de spam {u.spamScore}</li>}
                    {u.restrictedAt && <li className="text-orange-700 font-bold">compte restreint</li>}
                    <li className="text-slate-400">{u._count.listings} annonce(s) au total</li>
                  </ul>
                </td>
                <td className={`${TD} whitespace-nowrap text-slate-500`}>{fmtDate(u.createdAt)}</td>
                <td className={`${TD} text-right`}>
                  <div className="flex justify-end gap-2 flex-wrap">
                    <Link
                      href={`/admin/clients/${u.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      Voir
                    </Link>
                    {u.watchedAt ? <UnwatchButton userId={u.id} /> : <WatchButton userId={u.id} />}
                    <BanButton userId={u.id} userName={u.name} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </>
  );
}

// ── Comptes bannis ────────────────────────────────────────────────────────────

export async function BannedAccountsTab() {
  const users = await prisma.user.findMany({
    where: { bannedAt: { not: null }, role: { not: "ADMIN" } },
    orderBy: { bannedAt: "desc" },
    select: {
      ...USER_SELECT,
      phoneNumber: true,
      bannedAt: true,
      banReason: true,
      banDecidedBy: true,
      _count: { select: { listings: true } },
    },
  });

  const ids = users.map((u) => u.id);

  return (
    <>
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-extrabold text-rose-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">warning</span>
            {users.length} {users.length > 1 ? "comptes bannis" : "compte banni"}
          </p>
          <p className="text-xs text-rose-700/80 mt-1 max-w-xl">
            La suppression définitive efface les données personnelles et les fichiers associés. Seule
            une empreinte non réversible est conservée, dans un registre séparé, pour empêcher la
            réinscription.
          </p>
        </div>
        <PurgeBannedButton
          userIds={ids}
          label={
            users.length === 1
              ? "Supprimer définitivement le compte banni"
              : `Supprimer définitivement les ${users.length} comptes bannis`
          }
        />
      </div>

      <div className={CARD}>
        {users.length === 0 ? (
          <Empty>Aucun compte banni.</Empty>
        ) : (
          <div className="overflow-x-auto">
        <table className="w-full min-w-[860px]">
            <thead className="bg-slate-50 border-b border-[#eceef0]">
              <tr>
                <th className={TH}>Utilisateur</th>
                <th className={TH}>Email</th>
                <th className={TH}>Téléphone</th>
                <th className={TH}>Banni le</th>
                <th className={TH}>Motif</th>
                <th className={TH}>Confiance</th>
                <th className={TH}>Modérateur</th>
                <th className={`${TH} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2f4f6]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60">
                  <td className={TD}>
                    <Link href={`/admin/clients/${u.id}`} className="font-bold text-slate-900 hover:text-[#2f6fb8]">
                      {u.isPro && u.companyName ? u.companyName : u.name}
                    </Link>
                    <p className="text-xs text-slate-400">{u._count.listings} annonce(s)</p>
                  </td>
                  <td className={`${TD} text-slate-500 text-xs`}>{u.email}</td>
                  <td className={`${TD} text-slate-500 text-xs`}>{u.phoneNumber ?? "—"}</td>
                  <td className={`${TD} whitespace-nowrap text-slate-500`}>{fmtDate(u.bannedAt)}</td>
                  <td className={`${TD} max-w-xs`}>
                    <span className="text-slate-600 line-clamp-2">{u.banReason ?? "—"}</span>
                  </td>
                  <td className={`${TD} w-36`}>
                    <TrustGauge score={u.trustScore} size="sm" />
                  </td>
                  <td className={`${TD} text-xs text-slate-500`}>{u.banDecidedBy ?? "—"}</td>
                  <td className={`${TD} text-right`}>
                    <div className="flex justify-end gap-2 flex-wrap">
                      <Link
                        href={`/admin/clients/${u.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
                      >
                        Voir
                      </Link>
                      <UnbanButton userId={u.id} />
                      <PurgeBannedButton userIds={[u.id]} label="Supprimer définitivement" variant="row" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
        )}
      </div>
    </>
  );
}

// ── Historique ────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  PERMANENT_DELETE_BANNED_ACCOUNTS: "Suppression définitive de comptes bannis",
  PERMANENT_DELETE_LISTING: "Suppression définitive d'une annonce",
  LISTING_REMOVED: "Annonce retirée",
  LISTING_RESTORED: "Annonce remise en ligne",
  BAN_ACCOUNT: "Compte banni",
  UNBAN_ACCOUNT: "Bannissement levé",
  WATCH_ACCOUNT: "Compte mis sous surveillance",
  UNWATCH_ACCOUNT: "Surveillance levée",
  listing_removed: "Annonce retirée",
  listing_restored: "Annonce remise en ligne",
  listing_purged: "Annonce détruite (délai écoulé)",
  account_banned: "Compte banni",
  account_watched: "Compte mis sous surveillance",
  message_blocked: "Message bloqué",
  report_flagged: "Signalement enregistré",
  auto_reject: "Refus automatique",
  admin_delete: "Annonce supprimée par un admin",
};

export async function HistoryTab() {
  const [auditRows, events] = await Promise.all([
    prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 60 }),
    prisma.moderationEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { id: true, action: true, actor: true, reason: true, createdAt: true },
    }),
  ]);

  type Row = {
    id: string;
    at: Date;
    action: string;
    actor: string;
    detail: string;
    decisive: boolean;
  };

  const rows: Row[] = [
    ...auditRows.map((a) => ({
      id: `a-${a.id}`,
      at: a.createdAt,
      action: ACTION_LABELS[a.action] ?? a.action,
      actor: a.adminName ?? a.adminId,
      detail: [a.count > 1 ? `${a.count} élément(s)` : null, a.reason]
        .filter(Boolean)
        .join(" · "),
      decisive: true,
    })),
    ...events.map((e) => ({
      id: `e-${e.id}`,
      at: e.createdAt,
      action: ACTION_LABELS[e.action] ?? e.action,
      actor: e.actor,
      detail: e.reason,
      decisive: false,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  if (rows.length === 0) {
    return (
      <div className={CARD}>
        <Empty>Aucune décision enregistrée.</Empty>
      </div>
    );
  }

  return (
    <>
      <p className="text-xs text-slate-500 mb-3">
        Les actions en gras sont des décisions d'administration irréversibles, journalisées
        séparément. Le journal ne conserve aucune donnée personnelle des comptes supprimés.
      </p>
      <div className={CARD}>
        <ul className="divide-y divide-[#f2f4f6]">
          {rows.slice(0, 100).map((r) => (
            <li key={r.id} className="px-6 py-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xs font-mono text-slate-400 shrink-0 w-28">{fmtDateTime(r.at)}</span>
              <span
                className={`text-xs uppercase tracking-wider shrink-0 ${
                  r.decisive ? "font-extrabold text-rose-700" : "font-bold text-[#2f6fb8]"
                }`}
              >
                {r.action}
              </span>
              <span className="text-sm text-slate-600 min-w-0 flex-1 truncate">{r.detail}</span>
              <span className="text-xs text-slate-400 shrink-0">{r.actor}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

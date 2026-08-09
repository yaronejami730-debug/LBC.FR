"use client";

import { useState, useTransition } from "react";
import {
  verifyProAccount,
  requestProInfo,
  refuseProAccount,
  suspendProAccount,
  reinstateProAccount,
  deleteUserAccount,
  setVerificationBadge,
} from "./actions";

export type ProAccount = {
  id: string;
  name: string;
  email: string;
  companyName: string | null;
  siret: string | null;
  isPro: boolean;
  role: string;
  professionalStatus: string;
  proVerifiedAt: string | null;
  createdAt: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  bannedAt: string | null;
  verified: boolean;
  _count: { listings: number };
  proProfile: { slug: string; isPublished: boolean; _count: { services: number } } | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  NONE: { label: "Non vérifié", cls: "bg-slate-100 text-slate-600" },
  PENDING: { label: "En attente", cls: "bg-amber-100 text-amber-700" },
  INFO_REQUESTED: { label: "Infos demandées", cls: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "Vérifié", cls: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "Refusé", cls: "bg-rose-100 text-rose-700" },
  SUSPENDED: { label: "Suspendu", cls: "bg-rose-100 text-rose-700" },
};

/**
 * Une ligne = un compte professionnel, avec le même jeu d'actions que la file
 * de validation des annonces.
 *
 * La suppression demande de retaper l'email : c'est la seule action
 * irréversible de l'écran, et elle emporte les annonces du compte.
 */
export default function ProAccountRow({ account }: { account: ProAccount }) {
  const [pending, start] = useTransition();
  const [panel, setPanel] = useState<"none" | "info" | "refuse" | "suspend" | "delete">("none");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  // Affichage optimiste : le statut change à l'instant du clic, sans attendre
  // l'aller-retour serveur. En cas d'échec, on revient à l'état réel et le
  // message d'erreur explique pourquoi.
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [badge, setBadge] = useState(account.verified);

  const shownStatus = optimisticStatus ?? account.professionalStatus;
  const st = STATUS[shownStatus] ?? STATUS.NONE;

  function run(
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
    nextStatus?: string,
    disappears = false,
  ) {
    setError("");
    if (nextStatus) setOptimisticStatus(nextStatus);
    if (disappears) setRemoved(true);
    setPanel("none");
    setReason("");
    start(async () => {
      // L'action renvoie son échec au lieu de le lever : en production, une
      // exception dans une Server Action perd son message.
      const res = await fn().catch((e) => ({
        ok: false as const,
        error: e instanceof Error ? e.message : "Action impossible",
      }));
      if (res.ok) {
        setConfirm("");
        return;
      }
      setOptimisticStatus(null);
      setRemoved(false);
      setError(res.error);
    });
  }

  if (removed) {
    return (
      <div className="bg-white border border-[#eceef0] rounded-2xl px-4 py-3 text-sm text-slate-400">
        {account.companyName || account.name} — compte supprimé
      </div>
    );
  }

  return (
    <div
      className={`bg-white border border-[#eceef0] rounded-2xl p-4 transition-opacity ${
        pending ? "opacity-60" : "opacity-100"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-extrabold text-slate-900">
            {account.companyName || account.name}
            {account.role === "ADMIN" && (
              <span className="ml-2 rounded-full bg-[#d5e3fc] px-2 py-0.5 text-[10px] font-bold uppercase text-[#2f6fb8]">
                Admin
              </span>
            )}
          </p>
          <p className="text-sm text-slate-500">
            {account.name} · {account.email}
            {account.siret ? ` · SIRET ${account.siret}` : ""}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {account._count.listings} annonces · email{" "}
            {account.emailVerified ? "vérifié" : "non vérifié"} · inscrit le{" "}
            {new Date(account.createdAt).toLocaleDateString("fr-FR")}
            {account.proProfile
              ? ` · fiche /pro/${account.proProfile.slug} (${account.proProfile._count.services} prestations${account.proProfile.isPublished ? "" : ", masquée"})`
              : ""}
            {account.bannedAt ? " · compte banni" : ""}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${st.cls}`}>
          {st.label}
        </span>
      </div>

      {error && <p className="mt-2 text-sm font-semibold text-rose-700">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {shownStatus !== "APPROVED" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => verifyProAccount(account.id), "APPROVED")}
            className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            Vérifier
          </button>
        )}
        {shownStatus === "SUSPENDED" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => reinstateProAccount(account.id), "APPROVED")}
            className="rounded-full border border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50"
          >
            Réactiver
          </button>
        )}
        <Toggle label="Demander des infos" active={panel === "info"} onClick={() => setPanel(panel === "info" ? "none" : "info")} />
        <Toggle label="Refuser" active={panel === "refuse"} onClick={() => setPanel(panel === "refuse" ? "none" : "refuse")} tone="rose" />
        {shownStatus !== "SUSPENDED" && (
          <Toggle label="Suspendre" active={panel === "suspend"} onClick={() => setPanel(panel === "suspend" ? "none" : "suspend")} tone="rose" />
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const next = !badge;
            setBadge(next);
            start(async () => {
              const res = await setVerificationBadge(account.id, next).catch(() => ({
                ok: false as const,
                error: "Modification du badge impossible",
              }));
              if (!res.ok) {
                setBadge(!next);
                setError(res.error);
              }
            });
          }}
          className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
            badge
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-[#eceef0] bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {badge ? "Retirer le badge" : "Accorder le badge"}
        </button>
        <Toggle label="Supprimer le compte" active={panel === "delete"} onClick={() => setPanel(panel === "delete" ? "none" : "delete")} tone="rose" />
      </div>

      {(panel === "info" || panel === "refuse" || panel === "suspend") && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              panel === "info"
                ? "Ce que vous demandez au professionnel — envoyé par email."
                : "Motif envoyé à l'utilisateur."
            }
            className="w-full rounded-xl border border-[#eceef0] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/20"
          />
          {panel !== "info" && (
            <p className="mt-1 text-xs text-slate-500">
              Toutes les annonces du compte seront retirées du site.
            </p>
          )}
          <button
            type="button"
            disabled={pending || reason.trim().length < 5}
            onClick={() => {
              const action =
                panel === "info"
                  ? () => requestProInfo(account.id, reason)
                  : panel === "refuse"
                    ? () => refuseProAccount(account.id, reason)
                    : () => suspendProAccount(account.id, reason);
              const next =
                panel === "info" ? "INFO_REQUESTED" : panel === "refuse" ? "REJECTED" : "SUSPENDED";
              run(action, next);
            }}
            className="mt-2 rounded-full bg-[#2f6fb8] px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            Confirmer
          </button>
        </div>
      )}

      {panel === "delete" && (
        <div className="mt-3 rounded-xl bg-rose-50 p-3">
          <p className="text-sm font-bold text-rose-800">Suppression définitive</p>
          <p className="text-xs text-rose-700 mt-1 leading-relaxed">
            Le compte, ses annonces, ses photos, ses favoris et ses signalements sont effacés de la
            base. Action irréversible. Saisissez <strong>{account.email}</strong> pour confirmer.
          </p>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={account.email}
            className="mt-2 w-full rounded-xl border border-rose-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
          />
          <button
            type="button"
            disabled={pending || confirm.trim().toLowerCase() !== account.email.toLowerCase()}
            onClick={() => run(() => deleteUserAccount(account.id, confirm), undefined, true)}
            className="mt-2 rounded-full bg-rose-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            Supprimer définitivement
          </button>
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  active,
  onClick,
  tone,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: "rose";
}) {
  const base = tone === "rose" ? "border-rose-200 text-rose-700" : "border-[#eceef0] text-slate-600";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-xs font-bold transition ${base} ${
        active ? "bg-slate-100" : "bg-white hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

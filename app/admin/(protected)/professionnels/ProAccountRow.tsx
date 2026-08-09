"use client";

import { useState, useTransition } from "react";
import {
  verifyProAccount,
  requestProInfo,
  refuseProAccount,
  suspendProAccount,
  reinstateProAccount,
  deleteUserAccount,
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

  const st = STATUS[account.professionalStatus] ?? STATUS.NONE;

  function run(fn: () => Promise<void>) {
    setError("");
    start(async () => {
      try {
        await fn();
        setPanel("none");
        setReason("");
        setConfirm("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action impossible");
      }
    });
  }

  return (
    <div className="bg-white border border-[#eceef0] rounded-2xl p-4">
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
        {account.professionalStatus !== "APPROVED" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => verifyProAccount(account.id))}
            className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            Vérifier
          </button>
        )}
        {account.professionalStatus === "SUSPENDED" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => reinstateProAccount(account.id))}
            className="rounded-full border border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50"
          >
            Réactiver
          </button>
        )}
        <Toggle label="Demander des infos" active={panel === "info"} onClick={() => setPanel(panel === "info" ? "none" : "info")} />
        <Toggle label="Refuser" active={panel === "refuse"} onClick={() => setPanel(panel === "refuse" ? "none" : "refuse")} tone="rose" />
        {account.professionalStatus !== "SUSPENDED" && (
          <Toggle label="Suspendre" active={panel === "suspend"} onClick={() => setPanel(panel === "suspend" ? "none" : "suspend")} tone="rose" />
        )}
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
            onClick={() =>
              run(() =>
                panel === "info"
                  ? requestProInfo(account.id, reason)
                  : panel === "refuse"
                    ? refuseProAccount(account.id, reason)
                    : suspendProAccount(account.id, reason),
              )
            }
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
            onClick={() => run(() => deleteUserAccount(account.id, confirm))}
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

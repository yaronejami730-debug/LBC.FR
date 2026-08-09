"use client";

import { useState, useTransition } from "react";
import {
  approveVerification,
  rejectVerification,
  updateVerificationNote,
} from "./actions";

export type Dossier = {
  id: string;
  status: string;
  siret: string;
  companyName: string;
  idDocumentType: string;
  idDocumentPath: string;
  companyDocType: string;
  companyDocPath: string;
  submittedAt: string | Date;
  reviewedAt: string | Date | null;
  rejectionReason: string | null;
  adminNote: string | null;
  user: {
    id: string;
    email: string;
    name: string;
    createdAt: string | Date;
    isPro: boolean;
    phoneNumber: string | null;
    _count: { listings: number };
  };
};

const ID_LABELS: Record<string, string> = {
  CNI: "Carte d'identité",
  PASSEPORT: "Passeport",
  TITRE_SEJOUR: "Titre de séjour",
};

const COMPANY_LABELS: Record<string, string> = {
  KBIS: "Extrait Kbis",
  AVIS_SIRENE: "Avis SIRENE",
};

/** Les pièces ne sont pas publiques : elles transitent par la route admin. */
function docUrl(path: string) {
  return `/api/admin/pro-verification/document?path=${encodeURIComponent(path)}`;
}

export default function VerificationCard({ dossier }: { dossier: Dossier }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState(dossier.adminNote ?? "");
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState("");

  const submitted = new Date(dossier.submittedAt);
  const accountAgeDays = Math.floor(
    (Date.now() - new Date(dossier.user.createdAt).getTime()) / 86_400_000,
  );

  function run(fn: () => Promise<void>) {
    setError("");
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action impossible");
      }
    });
  }

  return (
    <div className="bg-white border border-[#eceef0] rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-extrabold text-slate-900 text-lg">{dossier.companyName}</p>
          <p className="text-sm text-slate-500 mt-0.5">
            SIRET <span className="font-mono">{dossier.siret}</span> ·{" "}
            <a
              href={`https://annuaire-entreprises.data.gouv.fr/etablissement/${dossier.siret}`}
              target="_blank"
              rel="noreferrer"
              className="text-[#2f6fb8] font-semibold hover:underline"
            >
              Vérifier à l&apos;annuaire des entreprises
            </a>
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {dossier.user.name} · {dossier.user.email}
            {dossier.user.phoneNumber ? ` · ${dossier.user.phoneNumber}` : ""}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Compte créé il y a {accountAgeDays} j · {dossier.user._count.listings} annonces ·
            déposé le {submitted.toLocaleDateString("fr-FR")} à{" "}
            {submitted.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
            dossier.status === "PENDING"
              ? "bg-amber-100 text-amber-700"
              : dossier.status === "APPROVED"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
          }`}
        >
          {dossier.status === "PENDING"
            ? "En attente"
            : dossier.status === "APPROVED"
              ? "Validé"
              : "Refusé"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <DocLink
          label={ID_LABELS[dossier.idDocumentType] ?? dossier.idDocumentType}
          caption="Pièce d'identité"
          href={docUrl(dossier.idDocumentPath)}
        />
        <DocLink
          label={COMPANY_LABELS[dossier.companyDocType] ?? dossier.companyDocType}
          caption="Justificatif d'entreprise"
          href={docUrl(dossier.companyDocPath)}
        />
      </div>

      <div className="mt-4">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          Note interne
        </label>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (note !== (dossier.adminNote ?? "")) {
              run(() => updateVerificationNote(dossier.id, note));
            }
          }}
          placeholder="Constat de vérification (nom du dirigeant, cohérence des pièces…)"
          className="w-full rounded-xl border border-[#eceef0] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/20"
        />
      </div>

      {dossier.rejectionReason && dossier.status === "REJECTED" && (
        <p className="mt-3 text-sm text-rose-700 bg-rose-50 rounded-xl px-3 py-2">
          Motif transmis : {dossier.rejectionReason}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      )}

      {dossier.status === "PENDING" && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => approveVerification(dossier.id))}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">verified</span>
            Valider le compte pro
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowReject((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-5 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
          >
            Refuser
          </button>
        </div>
      )}

      {showReject && dossier.status === "PENDING" && (
        <div className="mt-3 rounded-xl bg-rose-50 p-3">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-rose-700 mb-1">
            Motif envoyé à l&apos;utilisateur
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {[
              "Pièce d'identité illisible",
              "Justificatif d'entreprise de plus de 3 mois",
              "Le nom sur la pièce ne correspond pas au dirigeant déclaré",
              "SIRET ne correspondant pas à l'entreprise déclarée",
            ].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-rose-700 border border-rose-200 hover:bg-rose-100"
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motif précis — il est envoyé tel quel par email."
            className="w-full rounded-xl border border-rose-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-300"
          />
          <button
            type="button"
            disabled={pending || reason.trim().length < 5}
            onClick={() =>
              run(async () => {
                await rejectVerification(dossier.id, reason);
                setShowReject(false);
              })
            }
            className="mt-2 rounded-full bg-rose-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            Confirmer le refus
          </button>
        </div>
      )}
    </div>
  );
}

function DocLink({ label, caption, href }: { label: string; caption: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={`Ouvrir : ${caption}`}
      className="flex items-center gap-3 rounded-xl border border-[#eceef0] px-4 py-3 hover:border-[#2f6fb8] transition-colors"
    >
      <span className="material-symbols-outlined text-[22px] text-[#2f6fb8]">description</span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {caption}
        </span>
        <span className="block text-sm font-bold text-slate-800 truncate">{label}</span>
      </span>
    </a>
  );
}

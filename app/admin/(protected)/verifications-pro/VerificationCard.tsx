"use client";

import { useState, useTransition } from "react";
import {
  approveVerification,
  rejectVerification,
  requestVerificationInfo,
  suspendVerification,
  reinstateVerification,
  updateVerificationNote,
} from "./actions";

export type Compte = {
  id: string;
  status: string;
  requestType: string;
  siret: string;
  siren: string | null;
  companyName: string;
  commercialName: string | null;
  businessAddress: string | null;
  businessActivity: string | null;
  businessCategory: string | null;
  responsibleFirstName: string | null;
  responsibleLastName: string | null;
  professionalPhone: string | null;
  professionalEmail: string | null;
  infoRequest: string | null;
  logs: { id: string; action: string; actor: string; details: string | null; createdAt: string | Date }[];
  idDocumentType: string;
  idDocumentPath: string;
  companyDocType: string;
  companyDocPath: string;
  submittedAt: string | Date;
  reviewedAt: string | Date | null;
  rejectionReason: string | null;
  adminNote: string | null;
  documentsDeletedAt: string | Date | null;
  user: {
    id: string;
    email: string;
    name: string;
    createdAt: string | Date;
    isPro: boolean;
    phoneNumber: string | null;
    emailVerified: boolean;
    phoneVerified: boolean;
    professionalStatus: string;
    _count: { listings: number };
  };
};

const ID_LABELS: Record<string, string> = {
  CNI: "Carte d'identité",
  PASSEPORT: "Passeport",
  TITRE_SEJOUR: "Titre de séjour",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "À vérifier",
  INFO_REQUESTED: "Infos demandées",
  APPROVED: "Validé",
  REJECTED: "Refusé",
  SUSPENDED: "Suspendu",
};

const COMPANY_LABELS: Record<string, string> = {
  KBIS: "Extrait Kbis",
  AVIS_SIRENE: "Avis SIRENE",
};

/** Les pièces ne sont pas publiques : elles transitent par la route admin. */
function docUrl(path: string) {
  return `/api/admin/pro-verification/document?path=${encodeURIComponent(path)}`;
}

export default function VerificationCard({ compte }: { compte: Compte }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState(compte.adminNote ?? "");
  const [reason, setReason] = useState("");
  /** Formulaire ouvert : refus, demande d'info ou suspension. */
  const [panel, setPanel] = useState<"none" | "reject" | "info" | "suspend">("none");
  const [error, setError] = useState("");

  const submitted = new Date(compte.submittedAt);
  const accountAgeDays = Math.floor(
    (Date.now() - new Date(compte.user.createdAt).getTime()) / 86_400_000,
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
          <p className="font-extrabold text-slate-900 text-lg">{compte.companyName}</p>
          {compte.commercialName && compte.commercialName !== compte.companyName && (
            <p className="text-sm text-slate-600">Enseigne : {compte.commercialName}</p>
          )}
          <p className="text-sm text-slate-500 mt-0.5">
            SIRET <span className="font-mono">{compte.siret}</span>
            {compte.siren ? <> · SIREN <span className="font-mono">{compte.siren}</span></> : null} ·{" "}
            <a
              href={`https://annuaire-entreprises.data.gouv.fr/etablissement/${compte.siret}`}
              target="_blank"
              rel="noreferrer"
              className="text-[#2f6fb8] font-semibold hover:underline"
            >
              Vérifier à l&apos;annuaire des entreprises
            </a>
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {compte.user.name} · {compte.user.email}
            {compte.user.phoneNumber ? ` · ${compte.user.phoneNumber}` : ""}
          </p>
          {(compte.responsibleFirstName || compte.professionalPhone) && (
            <p className="text-sm text-slate-500 mt-1">
              Responsable :{" "}
              {[compte.responsibleFirstName, compte.responsibleLastName].filter(Boolean).join(" ") || "—"}
              {compte.professionalPhone ? ` · ${compte.professionalPhone}` : ""}
              {compte.professionalEmail ? ` · ${compte.professionalEmail}` : ""}
            </p>
          )}
          {(compte.businessAddress || compte.businessActivity) && (
            <p className="text-sm text-slate-500">
              {[compte.businessAddress, compte.businessActivity, compte.businessCategory]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <p className="text-xs text-slate-400 mt-1">
            {compte.requestType === "DIRECT_PROFESSIONAL"
              ? "Inscription professionnelle directe"
              : "Conversion particulier → professionnel"}{" "}
            · compte créé il y a {accountAgeDays} j · {compte.user._count.listings} annonces ·
            email {compte.user.emailVerified ? "vérifié" : "non vérifié"} · téléphone{" "}
            {compte.user.phoneVerified ? "vérifié" : "non vérifié"} · déposé le{" "}
            {submitted.toLocaleDateString("fr-FR")} à{" "}
            {submitted.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
            compte.status === "PENDING" || compte.status === "INFO_REQUESTED"
              ? "bg-amber-100 text-amber-700"
              : compte.status === "APPROVED"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
          }`}
        >
          {STATUS_LABELS[compte.status] ?? compte.status}
        </span>
      </div>

      {compte.documentsDeletedAt ? (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Pièces justificatives supprimées le{" "}
          {new Date(compte.documentsDeletedAt).toLocaleDateString("fr-FR")} — conformément à la
          durée de conservation. Types fournis :{" "}
          {ID_LABELS[compte.idDocumentType] ?? compte.idDocumentType} et{" "}
          {COMPANY_LABELS[compte.companyDocType] ?? compte.companyDocType}.
        </p>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <DocLink
          label={ID_LABELS[compte.idDocumentType] ?? compte.idDocumentType}
          caption="Pièce d'identité"
          href={docUrl(compte.idDocumentPath)}
        />
        <DocLink
          label={COMPANY_LABELS[compte.companyDocType] ?? compte.companyDocType}
          caption="Justificatif d'entreprise"
          href={docUrl(compte.companyDocPath)}
        />
      </div>
      )}

      <div className="mt-4">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          Note interne
        </label>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (note !== (compte.adminNote ?? "")) {
              run(() => updateVerificationNote(compte.id, note));
            }
          }}
          placeholder="Constat de vérification (nom du dirigeant, cohérence des pièces…)"
          className="w-full rounded-xl border border-[#eceef0] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/20"
        />
      </div>

      {compte.infoRequest && compte.status === "INFO_REQUESTED" && (
        <p className="mt-3 text-sm text-amber-800 bg-amber-50 rounded-xl px-3 py-2">
          Information demandée : {compte.infoRequest}
        </p>
      )}

      {compte.rejectionReason && compte.status === "REJECTED" && (
        <p className="mt-3 text-sm text-rose-700 bg-rose-50 rounded-xl px-3 py-2">
          Motif transmis : {compte.rejectionReason}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">
          {error}
        </p>
      )}

      {(compte.status === "PENDING" || compte.status === "INFO_REQUESTED") && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => approveVerification(compte.id))}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">verified</span>
            Approuver
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setPanel(panel === "info" ? "none" : "info")}
            className="inline-flex items-center gap-2 rounded-full border border-amber-200 px-5 py-2.5 text-sm font-bold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
          >
            Demander des informations
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setPanel(panel === "reject" ? "none" : "reject")}
            className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-5 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
          >
            Refuser
          </button>
        </div>
      )}

      {compte.status === "APPROVED" && (
        <div className="mt-4">
          <button
            type="button"
            disabled={pending}
            onClick={() => setPanel(panel === "suspend" ? "none" : "suspend")}
            className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-5 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">pause_circle</span>
            Suspendre l&apos;habilitation
          </button>
        </div>
      )}

      {compte.status === "SUSPENDED" && (
        <div className="mt-4">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => reinstateVerification(compte.id))}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            Réactiver le compte professionnel
          </button>
        </div>
      )}

      {panel !== "none" && (
        <ReasonPanel
          tone={panel === "info" ? "amber" : "rose"}
          title={
            panel === "info"
              ? "Information demandée au professionnel"
              : panel === "reject"
                ? "Motif de refus envoyé à l'utilisateur"
                : "Motif de suspension envoyé à l'utilisateur"
          }
          presets={
            panel === "info"
              ? [
                  "Merci de fournir un Kbis de moins de 3 mois.",
                  "La pièce d'identité est illisible, merci de la redéposer.",
                  "Merci de préciser l'activité exercée.",
                ]
              : panel === "reject"
                ? [
                    "Kbis invalide",
                    "Informations incohérentes",
                    "SIRET invalide",
                    "Document illisible",
                    "Activité non conforme",
                    "Informations insuffisantes",
                  ]
                : [
                    "Activité non conforme aux conditions d'utilisation",
                    "Signalements répétés",
                    "Documents devenus caducs",
                  ]
          }
          value={reason}
          onChange={setReason}
          disabled={pending}
          onConfirm={() =>
            run(async () => {
              if (panel === "info") await requestVerificationInfo(compte.id, reason);
              else if (panel === "reject") await rejectVerification(compte.id, reason);
              else await suspendVerification(compte.id, reason);
              setPanel("none");
              setReason("");
            })
          }
        />
      )}

      {compte.logs.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Historique ({compte.logs.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {compte.logs.map((l) => (
              <li key={l.id} className="text-xs text-slate-500">
                <span className="font-mono">
                  {new Date(l.createdAt).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>{" "}
                · <span className="font-bold text-slate-700">{l.action}</span> · {l.actor}
                {l.details ? ` — ${l.details}` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** Formulaire de motif partagé par le refus, la demande d'info et la suspension. */
function ReasonPanel({
  tone,
  title,
  presets,
  value,
  onChange,
  onConfirm,
  disabled,
}: {
  tone: "rose" | "amber";
  title: string;
  presets: string[];
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  disabled: boolean;
}) {
  const c =
    tone === "rose"
      ? { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", btn: "bg-rose-600 hover:bg-rose-700" }
      : { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", btn: "bg-amber-600 hover:bg-amber-700" };

  return (
    <div className={`mt-3 rounded-xl ${c.bg} p-3`}>
      <label className={`block text-[11px] font-bold uppercase tracking-wider ${c.text} mb-1`}>
        {title}
      </label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`rounded-full bg-white px-3 py-1 text-[11px] font-semibold ${c.text} border ${c.border} hover:opacity-80`}
          >
            {p}
          </button>
        ))}
      </div>
      <textarea
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ce texte est envoyé tel quel par email."
        className={`w-full rounded-xl border ${c.border} px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black/5`}
      />
      <button
        type="button"
        disabled={disabled || value.trim().length < 5}
        onClick={onConfirm}
        className={`mt-2 rounded-full ${c.btn} px-5 py-2 text-sm font-bold text-white transition disabled:opacity-50`}
      >
        Confirmer
      </button>
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

"use client";

import { useState, useTransition } from "react";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, BUDGET_LABELS } from "@/lib/advertiser-budgets";
import { updateLeadStatus, updateLeadNotes, deleteLead } from "./actions";

export type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  budget: string;
  company: string | null;
  message: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  contactedAt: Date | null;
  createdAt: Date;
};

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-[#fff8e1] text-[#9a6a12] border-[#f5d98b]",
  CONTACTED: "bg-[#eef4fb] text-[#2f6fb8] border-[#bcd6ee]",
  QUALIFIED: "bg-[#f3ecfd] text-[#6d4bb8] border-[#d5c4f2]",
  WON: "bg-[#e9f6ef] text-[#216b4d] border-[#a9d9c2]",
  LOST: "bg-[#fbeeea] text-[#b03a26] border-[#eec2b6]",
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
});

/** Délai écoulé depuis le dépôt, pour repérer d'un coup d'œil les rappels en retard. */
function elapsed(from: Date): { label: string; late: boolean } {
  const hours = Math.floor((Date.now() - new Date(from).getTime()) / 3_600_000);
  if (hours < 1) return { label: "à l'instant", late: false };
  if (hours < 24) return { label: `il y a ${hours} h`, late: false };
  const days = Math.floor(hours / 24);
  return { label: `il y a ${days} j`, late: hours > 48 };
}

export default function LeadCard({ lead }: { lead: Lead }) {
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [notesSaved, setNotesSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const age = elapsed(lead.createdAt);
  const awaitingCall = lead.status === "NEW" && age.late;

  return (
    <article className="bg-white border border-slate-100 rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-extrabold text-slate-900 text-lg leading-tight">
            {lead.firstName} {lead.lastName}
            {lead.company && (
              <span className="font-semibold text-slate-400"> · {lead.company}</span>
            )}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Reçue {age.label}
            {lead.contactedAt && ` · contactée le ${dateFmt.format(new Date(lead.contactedAt))}`}
            {lead.source && ` · via ${lead.source}`}
          </p>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-xs font-bold border ${
            STATUS_STYLES[lead.status] ?? "bg-slate-100 text-slate-500 border-slate-200"
          }`}
        >
          {LEAD_STATUS_LABELS[lead.status as keyof typeof LEAD_STATUS_LABELS] ?? lead.status}
        </span>

        {awaitingCall && (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#fbeeea] text-[#b03a26] border border-[#eec2b6]">
            Rappel en retard
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <a
          href={`tel:${lead.phone.replace(/\s/g, "")}`}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors font-semibold text-slate-700"
        >
          <span className="material-symbols-outlined text-base text-[#2f6fb8]">call</span>
          {lead.phone}
        </a>
        <a
          href={`mailto:${lead.email}`}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors font-semibold text-slate-700 truncate"
        >
          <span className="material-symbols-outlined text-base text-[#2f6fb8]">mail</span>
          <span className="truncate">{lead.email}</span>
        </a>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 font-semibold text-slate-700">
          <span className="material-symbols-outlined text-base text-[#2f6fb8]">payments</span>
          {BUDGET_LABELS[lead.budget as keyof typeof BUDGET_LABELS] ?? lead.budget}
        </div>
      </div>

      {lead.message && (
        <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 italic">
          « {lead.message} »
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {LEAD_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            disabled={pending || lead.status === s.value}
            onClick={() => startTransition(() => updateLeadStatus(lead.id, s.value))}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors disabled:opacity-100 ${
              lead.status === s.value
                ? STATUS_STYLES[s.value]
                : "bg-white border-slate-200 text-slate-500 hover:border-[#2f6fb8] hover:text-[#2f6fb8]"
            }`}
          >
            {s.label}
          </button>
        ))}

        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm(`Supprimer définitivement la demande de ${lead.firstName} ${lead.lastName} ?`)) {
              startTransition(() => deleteLead(lead.id));
            }
          }}
          className="ml-auto px-3 py-1.5 rounded-full text-xs font-bold text-slate-400 hover:text-[#b03a26] transition-colors"
        >
          Supprimer
        </button>
      </div>

      <div>
        <label
          htmlFor={`notes-${lead.id}`}
          className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5"
        >
          Notes internes
        </label>
        <textarea
          id={`notes-${lead.id}`}
          rows={2}
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setNotesSaved(false);
          }}
          onBlur={() => {
            if (notes === (lead.notes ?? "")) return;
            startTransition(async () => {
              await updateLeadNotes(lead.id, notes);
              setNotesSaved(true);
            });
          }}
          placeholder="Compte-rendu d'appel, budget réel, prochaine relance…"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition"
        />
        {notesSaved && <p className="text-xs text-[#216b4d] font-semibold mt-1">Notes enregistrées</p>}
      </div>
    </article>
  );
}

"use client";

import { useState, useTransition } from "react";
import { sendCampaignEmail, type CampaignAudience } from "@/app/admin/actions";

type Counts = { all: number; pro: number; particulier: number };

const AUDIENCES: { value: CampaignAudience; label: string; icon: string }[] = [
  { value: "all", label: "Tous", icon: "groups" },
  { value: "pro", label: "Professionnels", icon: "storefront" },
  { value: "particulier", label: "Particuliers", icon: "person" },
];

export default function CampaignForm({ counts }: { counts: Counts }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<CampaignAudience>("all");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  const recipientCount = counts[audience];

  const handleSend = () => {
    setError("");
    setResult(null);
    if (recipientCount === 0) {
      setError("Aucun destinataire consentant dans ce segment.");
      return;
    }
    const ok = window.confirm(
      `Envoyer cet email à ${recipientCount} destinataire(s) (${audience}) ?\nCette action est irréversible.`,
    );
    if (!ok) return;

    startTransition(async () => {
      try {
        const res = await sendCampaignEmail({ subject, message, audience });
        setResult(res);
        setSubject("");
        setMessage("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de l'envoi.");
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-[#eceef0] p-6 space-y-5 max-w-2xl">
      {/* Segment */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-[#777683]">
          Segment de destinataires
        </label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {AUDIENCES.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setAudience(a.value)}
              className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-sm font-semibold transition-all ${
                audience === a.value
                  ? "bg-[#2f6fb8] text-white border-[#2f6fb8]"
                  : "bg-white text-[#464652] border-[#eceef0] hover:bg-[#f7f9fb]"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{a.icon}</span>
              {a.label}
              <span
                className={`text-[11px] font-bold ${
                  audience === a.value ? "text-white/80" : "text-[#777683]"
                }`}
              >
                {counts[a.value]} contacts
              </span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[#777683] mt-2">
          Seuls les utilisateurs ayant accepté les communications marketing sont comptés (RGPD).
        </p>
      </div>

      {/* Sujet */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-[#777683]">
          Sujet
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={150}
          placeholder="Objet de l'email"
          className="w-full mt-1.5 px-4 py-2.5 rounded-xl border border-[#eceef0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30"
        />
      </div>

      {/* Message */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-[#777683]">
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={8}
          maxLength={5000}
          placeholder="Texte de la campagne. Une ligne vide sépare les paragraphes."
          className="w-full mt-1.5 px-4 py-3 rounded-xl border border-[#eceef0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 resize-y"
        />
        <p className="text-[11px] text-[#777683] mt-1">{message.length}/5000 caractères</p>
      </div>

      {error && (
        <p className="text-sm text-[#ba1a1a] bg-[#ffdad6] rounded-xl px-4 py-2.5">{error}</p>
      )}
      {result && (
        <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2.5">
          Campagne envoyée — {result.sent} envoyé(s)
          {result.failed > 0 ? `, ${result.failed} échec(s)` : ""} sur {result.total}.
        </p>
      )}

      {/* Envoi */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-sm text-[#777683]">
          Destinataires : <strong className="text-[#191c1e]">{recipientCount}</strong>
        </span>
        <button
          type="button"
          onClick={handleSend}
          disabled={isPending || !subject.trim() || !message.trim()}
          className="inline-flex items-center gap-2 bg-[#2f6fb8] text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-[#255a96] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[18px]">send</span>
          {isPending ? "Envoi en cours…" : "Envoyer la campagne"}
        </button>
      </div>
    </div>
  );
}

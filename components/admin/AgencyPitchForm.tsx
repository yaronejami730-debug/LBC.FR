"use client";

import { useState } from "react";
import { sendPitchBulk } from "@/app/admin/actions";

type Kind = "agency" | "particulier";

/**
 * Outil de démarchage en masse — envoie un email de pitch à plusieurs
 * destinataires (agences/pros B2B ou particuliers B2C).
 */
export default function AgencyPitchForm() {
  const [kind, setKind] = useState<Kind>("agency");
  const [emails, setEmails] = useState("");
  const [agency, setAgency] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<{
    sent: number;
    failed: number;
    total: number;
    invalid: string[];
  } | null>(null);

  // Compteur d'adresses détectées (aperçu live).
  const detected = [
    ...new Set(
      emails
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!emails.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    setResult(null);
    try {
      const r = await sendPitchBulk(emails, kind, agency.trim());
      setResult(r);
      setStatus("success");
      setEmails("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erreur lors de l'envoi");
      setStatus("error");
    }
  }

  const isAgency = kind === "agency";

  return (
    <div className="bg-white rounded-2xl border border-[#eceef0] p-6 space-y-4">
      <div>
        <h2 className="font-bold text-[#191c1e]">Démarchage en masse</h2>
        <p className="text-sm text-[#777683] mt-0.5">
          Colle plusieurs emails — un par ligne, ou séparés par virgule.
        </p>
      </div>

      {/* Type de cible */}
      <div className="flex gap-2">
        {([
          { id: "agency", label: "Agence / Pro", icon: "storefront" },
          { id: "particulier", label: "Particulier", icon: "person" },
        ] as { id: Kind; label: string; icon: string }[]).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setKind(opt.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
              kind === opt.id
                ? "bg-[#2f6fb8] text-white border-[#2f6fb8]"
                : "bg-white text-[#464652] border-[#eceef0] hover:bg-[#f7f9fb]"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
            {opt.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Nom d'agence — uniquement en mode agence */}
        {isAgency && (
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#777683]">
              Nom de l&apos;agence (optionnel)
            </span>
            <input
              type="text"
              value={agency}
              onChange={(e) => setAgency(e.target.value)}
              placeholder="BSK Paris 17, Century 21…"
              disabled={status === "loading"}
              className="w-full mt-1.5 px-4 py-2.5 rounded-xl border border-[#eceef0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 disabled:opacity-60"
            />
          </label>
        )}

        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#777683]">
            Emails des destinataires
          </span>
          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            rows={6}
            placeholder={"contact@agence1.fr\ncontact@agence2.fr\nclient@exemple.com"}
            required
            disabled={status === "loading"}
            className="w-full mt-1.5 px-4 py-3 rounded-xl border border-[#eceef0] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 disabled:opacity-60 resize-y"
          />
          <p className="text-[11px] text-[#777683] mt-1">{detected} adresse(s) détectée(s)</p>
        </label>

        <button
          type="submit"
          disabled={status === "loading" || detected === 0}
          className="inline-flex items-center gap-2 bg-[#2f6fb8] text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-[#255a96] disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">send</span>
          {status === "loading" ? "Envoi en cours…" : `Envoyer à ${detected} destinataire(s)`}
        </button>

        {status === "success" && result && (
          <div className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2.5">
            {result.sent} envoyé(s)
            {result.failed > 0 ? `, ${result.failed} échec(s)` : ""} sur {result.total}.
            {result.invalid.length > 0 && (
              <span className="block text-[11px] text-[#ba1a1a] mt-1">
                Ignorées (invalides) : {result.invalid.join(", ")}
              </span>
            )}
          </div>
        )}
        {status === "error" && (
          <p className="text-sm text-[#ba1a1a] bg-[#ffdad6] rounded-xl px-4 py-2.5">{errorMsg}</p>
        )}
      </form>
    </div>
  );
}

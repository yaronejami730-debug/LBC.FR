"use client";

import { useState } from "react";
import Link from "next/link";

type Existing = { keyPrefix: string; name: string; createdAt: Date; lastUsedAt: Date | null } | null;

export default function ApiKeyManager({ existing }: { existing: Existing }) {
  const [keyName, setKeyName]       = useState("");
  const [generatedKey, setGenerated] = useState("");
  const [loading, setLoading]       = useState(false);
  const [copied, setCopied]         = useState(false);
  const [confirmRevoke, setConfirm] = useState(false);
  const [revoked, setRevoked]       = useState(false);
  const [current, setCurrent]       = useState(existing);

  async function generate() {
    const name = keyName.trim() || "Ma clé API";
    setLoading(true);
    const res = await fetch("/api/profile/api-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setGenerated(data.key ?? "");
    setCurrent(null);
    setLoading(false);
    setKeyName("");
    setConfirm(false);
  }

  async function revoke() {
    await fetch("/api/profile/api-key", { method: "DELETE" });
    setRevoked(true);
    setCurrent(null);
    setGenerated("");
    setConfirm(false);
  }

  function copy() {
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Clé venant d'être générée ──────────────────────────────────────────────
  if (generatedKey) {
    return (
      <div className="space-y-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-700">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <p className="font-bold text-sm">Clé générée avec succès</p>
          </div>
          <div className="bg-white border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <code className="text-xs font-mono text-[#2f6fb8] break-all flex-1">{generatedKey}</code>
            <button
              onClick={copy}
              className="shrink-0 flex items-center gap-1 text-xs font-bold text-[#2f6fb8] hover:text-[#1a5a9e] transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">{copied ? "check" : "content_copy"}</span>
              {copied ? "Copié !" : "Copier"}
            </button>
          </div>
          <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            <p className="text-xs font-semibold">Cette clé n'est affichée qu'une seule fois. Copiez-la maintenant et conservez-la en sécurité.</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 text-center">
          Header à utiliser : <code className="font-mono text-slate-600">Authorization: Bearer {generatedKey.slice(0, 20)}…</code>
        </p>
      </div>
    );
  }

  // ── Formulaire de génération ───────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Clé active */}
      {current && !revoked ? (
        <div className="bg-[#f5f7fa] border border-slate-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Clé active</p>
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Active
            </span>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">{current.name}</p>
            <code className="text-sm font-mono font-bold text-slate-800">
              {current.keyPrefix}••••••••••••••••••••••••••••
            </code>
          </div>
          <div className="flex gap-4 text-[10px] text-slate-400">
            <span>Créée le {new Date(current.createdAt).toLocaleDateString("fr-FR")}</span>
            {current.lastUsedAt && (
              <span>Dernière utilisation : {new Date(current.lastUsedAt).toLocaleDateString("fr-FR")}</span>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 text-center text-sm text-slate-400">
          Aucune clé active
        </div>
      )}

      {/* Formulaire */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1.5">
            Nom de la clé <span className="text-slate-400 font-normal">(pour vous repérer)</span>
          </label>
          <input
            type="text"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="Ex : Mon logiciel DMS, Zapier, Site vitrine…"
            maxLength={60}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all"
          />
        </div>

        {current && !revoked ? (
          // Régénération avec confirmation
          !confirmRevoke ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setConfirm(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#2f6fb8] text-white rounded-xl text-sm font-bold hover:bg-[#1a5a9e] transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Regénérer la clé
              </button>
              <button
                onClick={() => { setConfirm(true); }}
                className="text-xs text-red-500 hover:text-red-700 font-semibold underline underline-offset-2"
              >
                Révoquer
              </button>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold text-red-700">L'ancienne clé sera immédiatement révoquée. Confirmer ?</p>
              <div className="flex gap-3">
                <button
                  onClick={generate}
                  disabled={loading}
                  className="px-4 py-2 bg-[#2f6fb8] text-white rounded-lg text-sm font-bold hover:bg-[#1a5a9e] transition-colors disabled:opacity-60"
                >
                  {loading ? "Génération…" : "Regénérer"}
                </button>
                <button
                  onClick={revoke}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors"
                >
                  Révoquer uniquement
                </button>
                <button
                  onClick={() => setConfirm(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm"
                >
                  Annuler
                </button>
              </div>
            </div>
          )
        ) : (
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#2f6fb8] text-white rounded-xl text-sm font-bold hover:bg-[#1a5a9e] transition-colors disabled:opacity-60"
          >
            {loading ? (
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-[16px]">key</span>
            )}
            {loading ? "Génération…" : "Générer une clé API"}
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">
        Endpoint :{" "}
        <code className="font-mono text-slate-600">POST /api/v1/listings</code>
        {" · "}
        <Link href="/api-doc" className="text-[#2f6fb8] hover:underline">Voir la documentation API →</Link>
      </p>
    </div>
  );
}

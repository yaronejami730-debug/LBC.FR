"use client";

import { useState } from "react";

type Props = { existing: { keyPrefix: string; createdAt: Date } | null };

export default function ApiKeyWidget({ existing }: Props) {
  const [key, setKey] = useState("");          // clé brute — affiché une fois
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [revoked, setRevoked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  async function generate() {
    setStatus("loading");
    const res = await fetch("/api/profile/api-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Clé API" }),
    });
    const data = await res.json();
    setKey(data.key ?? "");
    setStatus("done");
    setConfirmRevoke(false);
  }

  async function revoke() {
    await fetch("/api/profile/api-key", { method: "DELETE" });
    setRevoked(true);
    setKey("");
    setConfirmRevoke(false);
  }

  function copy() {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Clé brute venait d'être générée
  if (status === "done" && key) {
    return (
      <div className="bg-white rounded-2xl border border-[#eceef0] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-600 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>key</span>
          <p className="text-sm font-bold text-[#191c1e]">Clé API générée</p>
        </div>
        <div className="bg-[#f8f9fb] border border-[#eceef0] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <code className="text-xs font-mono text-[#2f6fb8] break-all">{key}</code>
          <button
            onClick={copy}
            className="shrink-0 flex items-center gap-1 text-xs font-semibold text-[#2f6fb8] hover:text-[#1a5a9e]"
          >
            <span className="material-symbols-outlined text-[16px]">{copied ? "check" : "content_copy"}</span>
            {copied ? "Copié" : "Copier"}
          </button>
        </div>
        <p className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
          Cette clé n'est affichée qu'une seule fois. Conservez-la en lieu sûr.
        </p>
        <p className="text-[10px] text-[#9ca3af]">
          Header à utiliser : <code className="font-mono text-[#464652]">Authorization: Bearer {key}</code>
        </p>
      </div>
    );
  }

  // Révoquée
  if (revoked) {
    return (
      <div className="bg-white rounded-2xl border border-[#eceef0] p-5 space-y-3">
        <p className="text-sm text-[#777683]">Clé API révoquée. Vous pouvez en générer une nouvelle.</p>
        <button onClick={generate} className="flex items-center gap-2 px-4 py-2 bg-[#2f6fb8] text-white rounded-xl text-sm font-bold hover:bg-[#1a5a9e] transition-all">
          <span className="material-symbols-outlined text-[16px]">add</span>
          Générer une clé API
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#eceef0] p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[#2f6fb8] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>api</span>
        <p className="text-sm font-bold text-[#191c1e]">Clé API</p>
        <span className="text-[10px] bg-[#e1e0ff] text-[#2f6fb8] font-bold px-2 py-0.5 rounded-full ml-auto">v1</span>
      </div>

      {existing && !revoked ? (
        <div className="space-y-3">
          <div className="bg-[#f8f9fb] border border-[#eceef0] rounded-xl px-4 py-3">
            <p className="text-xs text-[#777683] mb-0.5">Clé active</p>
            <code className="text-sm font-mono font-bold text-[#191c1e]">
              {existing.keyPrefix}••••••••••••••••••••••••••••••••
            </code>
            <p className="text-[10px] text-[#9ca3af] mt-1">
              Générée le {new Date(existing.createdAt).toLocaleDateString("fr-FR")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={generate}
              disabled={status === "loading"}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#2f6fb8] text-white rounded-xl text-sm font-bold hover:bg-[#1a5a9e] transition-all disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Regénérer
            </button>

            {!confirmRevoke ? (
              <button onClick={() => setConfirmRevoke(true)} className="text-xs text-red-500 hover:text-red-700 font-semibold underline underline-offset-2">
                Révoquer
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-xs text-[#464652]">Confirmer ?</p>
                <button onClick={revoke} className="text-xs font-bold text-red-600 hover:text-red-800">Oui, révoquer</button>
                <button onClick={() => setConfirmRevoke(false)} className="text-xs text-[#777683]">Annuler</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[#777683]">
            Générez une clé pour poster des annonces via votre logiciel (DMS, CRM…).
          </p>
          <button
            onClick={generate}
            disabled={status === "loading"}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#2f6fb8] text-white rounded-xl text-sm font-bold hover:bg-[#1a5a9e] transition-all disabled:opacity-60"
          >
            {status === "loading" ? (
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-[16px]">key</span>
            )}
            {status === "loading" ? "Génération…" : "Générer ma clé API"}
          </button>
        </div>
      )}

      <p className="text-[10px] text-[#9ca3af] border-t border-[#eceef0] pt-3">
        Endpoint : <code className="font-mono text-[#464652]">POST /api/v1/listings</code>
        {" · "}
        <a href="#api-doc" className="text-[#2f6fb8] hover:underline">Voir la documentation ↓</a>
      </p>
    </div>
  );
}

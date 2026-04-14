"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PRESETS = [
  { label: "Été 🏖️",     from: "#f97316", to: "#ea580c", title: "C'est l'été sur Deal & Co !", subtitle: "Maillots, lunettes, mobilier de jardin… les bonnes affaires de la saison" },
  { label: "Hiver ⛷️",   from: "#3b82f6", to: "#1d4ed8", title: "Équipez-vous pour l'hiver", subtitle: "Skis, doudounes, équipements de montagne à petits prix" },
  { label: "Rentrée 📚",  from: "#8b5cf6", to: "#6d28d9", title: "La rentrée commence ici", subtitle: "Fournitures, électronique, mobilier étudiant — tout en occasion" },
  { label: "Noël 🎄",     from: "#dc2626", to: "#991b1b", title: "Offrez malin pour Noël", subtitle: "Des milliers d'idées cadeaux entre particuliers, sans se ruiner" },
  { label: "Printemps 🌸", from: "#10b981", to: "#047857", title: "Le printemps est là !", subtitle: "Vélos, jardinage, sport en plein air — la saison des bonnes affaires" },
  { label: "Défaut 💙",   from: "#2f6fb8", to: "#1a5a9e", title: "Petites annonces gratuites près de chez vous.", subtitle: "" },
];

export default function BannerForm() {
  const router = useRouter();
  const [title, setTitle] = useState("Petites annonces gratuites près de chez vous.");
  const [subtitle, setSubtitle] = useState("");
  const [from, setFrom] = useState("#2f6fb8");
  const [to, setTo] = useState("#1a5a9e");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function applyPreset(p: typeof PRESETS[0]) {
    setTitle(p.title);
    setSubtitle(p.subtitle);
    setFrom(p.from);
    setTo(p.to);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    await fetch("/api/admin/hero-banner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, subtitle, bgFrom: from, bgTo: to, startsAt: startsAt || null, endsAt: endsAt || null }),
    });
    setLoading(false);
    setSuccess(true);
    router.refresh();
  }

  const inputCls = "w-full border border-[#eceef0] rounded-xl px-3 py-2.5 text-sm text-[#191c1e] outline-none focus:border-[#2f6fb8] transition-colors bg-white";
  const labelCls = "block text-[11px] font-bold text-[#777683] uppercase tracking-widest mb-1.5";

  return (
    <div className="bg-white rounded-2xl border border-[#eceef0] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#eceef0]">
        <h2 className="text-[15px] font-bold text-[#191c1e]">Nouvelle bannière</h2>
      </div>

      {/* Prévisualisation */}
      <div className="px-6 pt-5 pb-4">
        <p className={labelCls}>Prévisualisation</p>
        <div className="relative rounded-xl overflow-hidden p-5 min-h-[80px] flex flex-col justify-center"
          style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
          <p className="text-white font-extrabold text-lg leading-tight tracking-tight">
            {title || "Titre de la bannière"}
          </p>
          {subtitle && <p className="text-white/80 text-sm mt-1">{subtitle}</p>}
        </div>
      </div>

      {/* Presets */}
      <div className="px-6 pb-5">
        <p className={labelCls}>Modèles saisonniers</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => applyPreset(p)}
              className="text-[12px] font-medium px-3 py-1.5 rounded-full border border-[#eceef0] hover:border-[#2f6fb8] hover:text-[#2f6fb8] text-[#464652] transition-colors">
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4 border-t border-[#f2f4f6] pt-5">
        {/* Titre */}
        <div>
          <label className={labelCls}>Titre *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required className={inputCls} />
        </div>

        {/* Sous-titre */}
        <div>
          <label className={labelCls}>Sous-titre <span className="normal-case font-normal text-[#b0b0b0]">(optionnel)</span></label>
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={inputCls} placeholder="Texte affiché sous le titre" />
        </div>

        {/* Couleurs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Couleur début</label>
            <div className="flex items-center gap-2.5 border border-[#eceef0] rounded-xl px-3 py-2 bg-white hover:border-[#2f6fb8] transition-colors">
              <input type="color" value={from} onChange={(e) => setFrom(e.target.value)}
                className="w-7 h-7 rounded-lg cursor-pointer border-none bg-transparent p-0" />
              <span className="text-[12px] font-mono text-[#777683]">{from}</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>Couleur fin</label>
            <div className="flex items-center gap-2.5 border border-[#eceef0] rounded-xl px-3 py-2 bg-white hover:border-[#2f6fb8] transition-colors">
              <input type="color" value={to} onChange={(e) => setTo(e.target.value)}
                className="w-7 h-7 rounded-lg cursor-pointer border-none bg-transparent p-0" />
              <span className="text-[12px] font-mono text-[#777683]">{to}</span>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Début <span className="normal-case font-normal text-[#b0b0b0]">(optionnel)</span></label>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Fin <span className="normal-case font-normal text-[#b0b0b0]">(optionnel)</span></label>
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputCls} />
          </div>
        </div>

        {success && (
          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2.5 rounded-xl text-sm font-medium">
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            Bannière créée avec succès
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full bg-[#2f6fb8] hover:bg-[#1a5a9e] text-white font-bold py-2.5 rounded-full transition-colors disabled:opacity-60 text-sm">
          {loading ? "Création…" : "Créer la bannière"}
        </button>
      </form>
    </div>
  );
}

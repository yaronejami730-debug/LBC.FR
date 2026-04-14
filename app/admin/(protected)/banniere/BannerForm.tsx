"use client";

import { useState, useRef } from "react";
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
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle]       = useState("Petites annonces gratuites près de chez vous.");
  const [subtitle, setSubtitle] = useState("");
  const [from, setFrom]         = useState("#2f6fb8");
  const [to, setTo]             = useState("#1a5a9e");
  const [bgImage, setBgImage]   = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState("");

  function applyPreset(p: typeof PRESETS[0]) {
    setTitle(p.title);
    setSubtitle(p.subtitle);
    setFrom(p.from);
    setTo(p.to);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();
    if (data.url) setBgImage(data.url);
    setUploading(false);
    e.target.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError("");
    try {
      const res = await fetch("/api/admin/hero-banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subtitle, bgFrom: from, bgTo: to, bgImage: bgImage || null, startsAt: startsAt || null, endsAt: endsAt || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(`Erreur ${res.status} : ${data.error ?? "inconnue"}`);
      } else {
        setSuccess(true);
        // Hard reload pour forcer le rechargement du Server Component
        window.location.reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full border border-[#eceef0] rounded-xl px-3 py-2.5 text-sm text-[#191c1e] outline-none focus:border-[#2f6fb8] transition-colors bg-white";
  const labelCls = "block text-[11px] font-bold text-[#777683] uppercase tracking-widest mb-1.5";

  // Style de preview : image si dispo, sinon dégradé
  const previewStyle = bgImage
    ? { backgroundImage: `linear-gradient(135deg, ${from}99, ${to}cc), url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center", backgroundBlendMode: "multiply" }
    : { background: `linear-gradient(135deg, ${from}, ${to})` };

  return (
    <div className="bg-white rounded-2xl border border-[#eceef0] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#eceef0]">
        <h2 className="text-[15px] font-bold text-[#191c1e]">Nouvelle bannière</h2>
      </div>

      {/* Prévisualisation */}
      <div className="px-6 pt-5 pb-4">
        <p className={labelCls}>Prévisualisation</p>
        <div className="relative rounded-xl overflow-hidden p-5 min-h-[90px] flex flex-col justify-center" style={previewStyle}>
          <p className="text-white font-extrabold text-lg leading-tight tracking-tight drop-shadow">
            {title || "Titre de la bannière"}
          </p>
          {subtitle && <p className="text-white/80 text-sm mt-1 drop-shadow">{subtitle}</p>}
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

        {/* Photo de fond */}
        <div>
          <label className={labelCls}>Photo de fond <span className="normal-case font-normal text-[#b0b0b0]">(optionnel)</span></label>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          {bgImage ? (
            <div className="relative rounded-xl overflow-hidden h-20 border border-[#eceef0]">
              <img src={bgImage} alt="Fond" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setBgImage("")}
                className="absolute top-2 right-2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors">
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full border-2 border-dashed border-[#eceef0] rounded-xl py-5 flex flex-col items-center gap-1.5 text-[#777683] hover:border-[#2f6fb8] hover:text-[#2f6fb8] transition-colors disabled:opacity-50">
              {uploading
                ? <div className="w-5 h-5 border-2 border-[#2f6fb8] border-t-transparent rounded-full animate-spin" />
                : <span className="material-symbols-outlined text-2xl">add_photo_alternate</span>
              }
              <span className="text-[12px] font-medium">{uploading ? "Upload…" : "Cliquez pour ajouter une photo"}</span>
            </button>
          )}
          <p className="text-[10px] text-[#777683] mt-1.5">
            Taille recommandée : <strong>1440 × 400 px</strong> (format paysage large) — JPG ou PNG, max 5 Mo.<br/>
            Le dégradé de couleurs se superpose à la photo pour assurer la lisibilité du texte.
          </p>
        </div>

        {/* Couleurs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Couleur début</label>
            <div className="flex items-center gap-2.5 border border-[#eceef0] rounded-xl px-3 py-2 bg-white hover:border-[#2f6fb8] transition-colors cursor-pointer" onClick={() => document.getElementById("colorFrom")?.click()}>
              <input id="colorFrom" type="color" value={from} onChange={(e) => setFrom(e.target.value)} className="w-7 h-7 rounded-lg cursor-pointer border-none bg-transparent p-0" />
              <span className="text-[12px] font-mono text-[#777683]">{from}</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>Couleur fin</label>
            <div className="flex items-center gap-2.5 border border-[#eceef0] rounded-xl px-3 py-2 bg-white hover:border-[#2f6fb8] transition-colors cursor-pointer" onClick={() => document.getElementById("colorTo")?.click()}>
              <input id="colorTo" type="color" value={to} onChange={(e) => setTo(e.target.value)} className="w-7 h-7 rounded-lg cursor-pointer border-none bg-transparent p-0" />
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

        {error && (
          <div className="flex items-center gap-2 text-[#ba1a1a] bg-[#ffdad6] px-4 py-2.5 rounded-xl text-sm font-medium">
            <span className="material-symbols-outlined text-[16px]">error</span>
            {error}
          </div>
        )}

        <button type="submit" disabled={loading || uploading}
          className="w-full bg-[#2f6fb8] hover:bg-[#1a5a9e] text-white font-bold py-2.5 rounded-full transition-colors disabled:opacity-60 text-sm">
          {loading ? "Création…" : "Créer la bannière"}
        </button>
      </form>
    </div>
  );
}

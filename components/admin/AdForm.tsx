"use client";

import { useRef, useState, useTransition } from "react";
import { createAdvertisement, deleteAdvertisement, updateAdvertisement } from "@/app/admin/actions";

type Ad = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  destinationUrl: string;
  isActive: boolean;
  createdAt: Date;
};

export default function AdForm({ ads }: { ads: Ad[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [preview, setPreview] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Seules les images sont acceptées");
      return;
    }
    setIsUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'upload");
      setImageUrl(data.url);
      setPreview(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur upload");
    } finally {
      setIsUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!imageUrl) {
      setError("Veuillez ajouter une image");
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.set("imageUrl", imageUrl);
    setError("");
    startTransition(async () => {
      try {
        await createAdvertisement(fd);
        formRef.current?.reset();
        setImageUrl("");
        setPreview("");
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Create button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#777683]">{ads.length} publicité{ads.length !== 1 ? "s" : ""} au total</p>
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 bg-[#15157d] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#2e3192] transition-colors active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px]">{open ? "close" : "add"}</span>
          {open ? "Annuler" : "Nouvelle publicité"}
        </button>
      </div>

      {/* Create form */}
      {open && (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="bg-white border border-[#eceef0] rounded-2xl p-6 space-y-4"
        >
          <h3 className="font-bold text-[#191c1e]">Créer une publicité</h3>
          {error && (
            <p className="text-xs text-[#ba1a1a] bg-[#ffdad6] px-3 py-2 rounded-lg">{error}</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#464652] uppercase tracking-wide">Titre *</label>
              <input
                name="title"
                required
                placeholder="Ex: Découvrez notre partenaire"
                className="w-full text-sm border border-[#c7c5d4] rounded-xl px-3 py-2.5 outline-none focus:border-[#15157d] focus:ring-1 focus:ring-[#15157d]/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#464652] uppercase tracking-wide">URL destination *</label>
              <input
                name="destinationUrl"
                type="url"
                required
                placeholder="https://partenaire.com"
                className="w-full text-sm border border-[#c7c5d4] rounded-xl px-3 py-2.5 outline-none focus:border-[#15157d] focus:ring-1 focus:ring-[#15157d]/20"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#464652] uppercase tracking-wide">Image *</label>
            <input type="hidden" name="imageUrl" value={imageUrl} />
            {preview ? (
              <div className="relative aspect-video rounded-xl overflow-hidden bg-[#f2f4f6]">
                <img src={preview} alt="Aperçu" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setImageUrl(""); setPreview(""); }}
                  className="absolute top-2 right-2 bg-white rounded-full p-1 shadow hover:bg-[#f2f4f6] transition-colors"
                >
                  <span className="material-symbols-outlined text-sm text-[#191c1e]">close</span>
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragging ? "border-[#15157d] bg-[#e1e0ff]" : "border-[#c7c5d4] hover:border-[#15157d] hover:bg-[#f7f7ff]"
                }`}
              >
                {isUploading ? (
                  <p className="text-sm text-[#777683]">Chargement en cours…</p>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-4xl text-[#777683]" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_upload</span>
                    <p className="text-sm text-[#777683] mt-2">
                      Glisser-déposer une image ici ou{" "}
                      <span className="text-[#15157d] font-semibold">parcourir</span>
                    </p>
                    <p className="text-xs text-[#aaa9b8] mt-1">PNG, JPG, WEBP acceptés</p>
                  </>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#464652] uppercase tracking-wide">Description courte *</label>
            <textarea
              name="description"
              required
              rows={2}
              placeholder="Courte accroche visible sur la carte"
              className="w-full text-sm border border-[#c7c5d4] rounded-xl px-3 py-2.5 outline-none focus:border-[#15157d] focus:ring-1 focus:ring-[#15157d]/20 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-[#777683] hover:text-[#191c1e] px-4 py-2 rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="text-sm bg-[#15157d] text-white font-semibold px-6 py-2 rounded-xl hover:bg-[#2e3192] transition-colors disabled:opacity-60 active:scale-95"
            >
              {isPending ? "Création…" : "Créer la publicité"}
            </button>
          </div>
        </form>
      )}

      {/* Ads grid */}
      {ads.length === 0 ? (
        <div className="bg-white border border-[#eceef0] rounded-2xl py-16 text-center">
          <span className="material-symbols-outlined text-5xl text-[#c7c5d4]" style={{ fontVariationSettings: "'FILL' 1" }}>
            campaign
          </span>
          <p className="text-[#777683] mt-3 font-medium">Aucune publicité créée</p>
          <p className="text-sm text-[#777683] mt-1">Cliquez sur &quot;Nouvelle publicité&quot; pour commencer</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {ads.map((ad) => (
            <AdCard
              key={ad.id}
              ad={ad}
              isPending={isPending}
              startTransition={startTransition}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AdCard({
  ad,
  isPending,
  startTransition,
}: {
  ad: Ad;
  isPending: boolean;
  startTransition: ReturnType<typeof useTransition>[1];
}) {
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState("");
  const [editImageUrl, setEditImageUrl] = useState(ad.imageUrl);
  const [editPreview, setEditPreview] = useState(ad.imageUrl);
  const [editIsDragging, setEditIsDragging] = useState(false);
  const [editIsUploading, setEditIsUploading] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  async function uploadEditFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setEditError("Seules les images sont acceptées");
      return;
    }
    setEditIsUploading(true);
    setEditError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur upload");
      setEditImageUrl(data.url);
      setEditPreview(data.url);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Erreur upload");
    } finally {
      setEditIsUploading(false);
    }
  }

  function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editImageUrl) { setEditError("Image requise"); return; }
    const fd = new FormData(e.currentTarget);
    fd.set("imageUrl", editImageUrl);
    setEditError("");
    startTransition(async () => {
      try {
        await updateAdvertisement(ad.id, fd);
        setEditing(false);
      } catch (err) {
        setEditError(err instanceof Error ? err.message : "Erreur");
      }
    });
  }

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden transition-all ${ad.isActive ? "border-[#eceef0]" : "border-[#eceef0] opacity-60"}`}>
      {/* Image + badge */}
      <div className="relative aspect-video overflow-hidden bg-[#f2f4f6]">
        <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
        <span className="absolute top-2 left-2 bg-[#15157d] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
          Publicité
        </span>
        {!ad.isActive && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <span className="bg-white/90 text-[#191c1e] text-xs font-bold px-3 py-1 rounded-full">Désactivée</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        <p className="font-bold text-[#191c1e] text-sm line-clamp-1">{ad.title}</p>
        <p className="text-xs text-[#777683] line-clamp-2">{ad.description}</p>
        <a
          href={ad.destinationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-[#15157d] font-semibold flex items-center gap-1 hover:underline"
        >
          <span className="material-symbols-outlined text-[12px]">link</span>
          {ad.destinationUrl.replace(/^https?:\/\//, "").slice(0, 35)}…
        </a>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex items-center gap-2">
        <button
          onClick={() => { setEditing((v) => !v); setEditError(""); }}
          disabled={isPending}
          className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-[#e1e0ff] text-[#15157d] hover:bg-[#c7c5ff] transition-colors disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-1 justify-center">
            <span className="material-symbols-outlined text-[14px]">edit</span>
            {editing ? "Annuler" : "Modifier la publicité"}
          </span>
        </button>
        <button
          onClick={() => {
            if (confirm("Supprimer cette publicité ?")) {
              startTransition(async () => {
                try { await deleteAdvertisement(ad.id); }
                catch { /* ignore */ }
              });
            }
          }}
          disabled={isPending}
          className="text-xs font-semibold py-1.5 px-3 rounded-lg bg-[#ffdad6] text-[#ba1a1a] hover:bg-[#ffb4ab] transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[14px]">delete</span>
        </button>
      </div>

      {/* Inline edit form */}
      {editing && (
        <form onSubmit={handleEditSubmit} className="border-t border-[#eceef0] p-4 space-y-3 bg-[#f7f7ff]">
          {editError && <p className="text-xs text-[#ba1a1a] bg-[#ffdad6] px-3 py-1.5 rounded-lg">{editError}</p>}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[#464652] uppercase tracking-wide">Titre</label>
            <input name="title" defaultValue={ad.title} required
              className="w-full text-sm border border-[#c7c5d4] rounded-xl px-3 py-2 outline-none focus:border-[#15157d]" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[#464652] uppercase tracking-wide">URL destination</label>
            <input name="destinationUrl" type="url" defaultValue={ad.destinationUrl} required
              className="w-full text-sm border border-[#c7c5d4] rounded-xl px-3 py-2 outline-none focus:border-[#15157d]" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[#464652] uppercase tracking-wide">Description</label>
            <textarea name="description" defaultValue={ad.description} required rows={2}
              className="w-full text-sm border border-[#c7c5d4] rounded-xl px-3 py-2 outline-none focus:border-[#15157d] resize-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-[#464652] uppercase tracking-wide">Image</label>
            <input type="hidden" name="imageUrl" value={editImageUrl} />
            {editPreview ? (
              <div className="relative aspect-video rounded-xl overflow-hidden bg-[#f2f4f6]">
                <img src={editPreview} alt="Aperçu" className="w-full h-full object-cover" />
                <button type="button" onClick={() => { setEditImageUrl(""); setEditPreview(""); }}
                  className="absolute top-2 right-2 bg-white rounded-full p-1 shadow hover:bg-[#f2f4f6]">
                  <span className="material-symbols-outlined text-sm text-[#191c1e]">close</span>
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setEditIsDragging(true); }}
                onDragLeave={() => setEditIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setEditIsDragging(false); const f = e.dataTransfer.files[0]; if (f) uploadEditFile(f); }}
                onClick={() => editFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${editIsDragging ? "border-[#15157d] bg-[#e1e0ff]" : "border-[#c7c5d4] hover:border-[#15157d]"}`}
              >
                {editIsUploading ? <p className="text-sm text-[#777683]">Chargement…</p> : (
                  <>
                    <span className="material-symbols-outlined text-3xl text-[#777683]" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_upload</span>
                    <p className="text-xs text-[#777683] mt-1">Glisser-déposer ou <span className="text-[#15157d] font-semibold">parcourir</span></p>
                  </>
                )}
              </div>
            )}
            <input ref={editFileInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadEditFile(f); }} />
          </div>
          <button type="submit" disabled={isPending}
            className="w-full text-sm bg-[#15157d] text-white font-semibold py-2 rounded-xl hover:bg-[#2e3192] transition-colors disabled:opacity-60">
            {isPending ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </form>
      )}
    </div>
  );
}

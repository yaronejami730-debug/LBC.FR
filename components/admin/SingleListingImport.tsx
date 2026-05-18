"use client";

import { useState, useTransition } from "react";
import { importListingByUrl } from "@/app/admin/actions";
import UserPicker, { type UserOption } from "@/components/admin/UserPicker";

type Imported = {
  url: string;
  title: string;
  listingId: string;
  status: string;
  deduplicated: boolean;
};

/**
 * Import unitaire d'annonces — lien par lien. L'admin colle l'URL d'une
 * annonce externe, elle est extraite et créée sous le compte choisi.
 * Le compte sélectionné reste en place pour enchaîner plusieurs imports.
 */
export default function SingleListingImport() {
  const [owner, setOwner] = useState<UserOption | null>(null);
  const [url, setUrl] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState<Imported[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!owner) {
      setError("Sélectionne un compte propriétaire.");
      return;
    }
    if (!url.trim()) return;
    const target = url.trim();
    startTransition(async () => {
      try {
        const r = await importListingByUrl(owner.id, target);
        setDone((p) => [{ url: target, ...r }, ...p]);
        setUrl(""); // prêt pour le lien suivant — le compte reste sélectionné
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-[#eceef0] p-6 space-y-4">
      <div>
        <h2 className="font-bold text-[#191c1e]">Import unitaire — lien par lien</h2>
        <p className="text-sm text-[#777683] mt-0.5">
          Colle l&apos;URL d&apos;une annonce → elle est importée. Recommence pour la suivante.
        </p>
      </div>

      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#777683]">
          Compte propriétaire
        </span>
        <UserPicker selected={owner} onSelect={setOwner} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#777683]">
            URL de l&apos;annonce
          </span>
          <div className="flex gap-2 mt-1.5">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              disabled={isPending}
              placeholder="https://www.site.com/bien/appartement-t3-12345"
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#eceef0] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isPending || !url.trim()}
              className="inline-flex items-center gap-2 bg-[#2f6fb8] text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-[#255a96] disabled:opacity-50 flex-shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              {isPending ? "Import…" : "Importer"}
            </button>
          </div>
        </label>

        {error && (
          <p className="text-sm text-[#ba1a1a] bg-[#ffdad6] rounded-xl px-4 py-2.5">{error}</p>
        )}
      </form>

      {done.length > 0 && (
        <div className="border-t border-[#f2f4f6] pt-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#777683] mb-2">
            Importées cette session ({done.length})
          </p>
          <ul className="space-y-1.5">
            {done.map((d, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <span
                  className="material-symbols-outlined text-[14px] text-emerald-500"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {d.deduplicated ? "sync" : "check_circle"}
                </span>
                <a
                  href={`/annonce/${d.listingId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#2f6fb8] hover:underline truncate max-w-[280px]"
                >
                  {d.title}
                </a>
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#f2f4f6] text-[#515f74]">
                  {d.deduplicated ? "mis à jour" : d.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

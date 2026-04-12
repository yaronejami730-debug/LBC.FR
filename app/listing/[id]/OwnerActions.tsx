"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function OwnerActions({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/listings/${listingId}`, { method: "DELETE" });
      router.push("/profile");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3 w-full">
      <Link
        href={`/listing/${listingId}/edit`}
        className="w-full py-3.5 rounded-2xl bg-[#15157d] text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#1e1eaa] transition-all"
      >
        <span className="material-symbols-outlined text-[18px]">edit</span>
        Modifier l'annonce
      </Link>

      {confirm ? (
        <div className="space-y-2">
          <p className="text-center text-sm text-red-600 font-semibold">Confirmer la suppression ?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirm(false)}
              className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-all disabled:opacity-60"
            >
              {deleting ? "Suppression…" : "Supprimer"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirm(true)}
          className="w-full py-3.5 rounded-2xl border border-red-200 text-red-500 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-50 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
          Supprimer l'annonce
        </button>
      )}
    </div>
  );
}

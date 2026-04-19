"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Status = "APPROVED" | "PENDING" | "REJECTED" | string;

export default function OwnerActions({
  listingId,
  status,
  rejectionReason,
  createdAt,
}: {
  listingId: string;
  status?: Status;
  rejectionReason?: string | null;
  createdAt?: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [showApprovedBadge, setShowApprovedBadge] = useState(false);

  useEffect(() => {
    if (status !== "APPROVED" || !createdAt) return;
    const ageMs = Date.now() - new Date(createdAt).getTime();
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    if (ageMs < TWO_HOURS) {
      setShowApprovedBadge(true);
      const remaining = TWO_HOURS - ageMs;
      const timer = setTimeout(() => setShowApprovedBadge(false), remaining);
      return () => clearTimeout(timer);
    }
  }, [status, createdAt]);

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
      {status === "REJECTED" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
          <span className="material-symbols-outlined text-red-500 text-[20px] mt-0.5">block</span>
          <div className="flex-1 min-w-0">
            <p className="text-red-700 font-bold text-sm">Annonce refusée</p>
            {rejectionReason && (
              <p className="text-red-700/80 text-xs mt-0.5 leading-snug">{rejectionReason}</p>
            )}
          </div>
        </div>
      )}

      {status === "PENDING" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-600 text-[20px] mt-0.5">hourglass_top</span>
          <div className="flex-1 min-w-0">
            <p className="text-amber-800 font-bold text-sm">En attente de validation</p>
            <p className="text-amber-700/80 text-xs mt-0.5 leading-snug">Votre annonce sera visible dès qu'elle sera validée.</p>
          </div>
        </div>
      )}

      {showApprovedBadge && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-3">
          <span className="material-symbols-outlined text-emerald-600 text-[20px] mt-0.5">check_circle</span>
          <div className="flex-1 min-w-0">
            <p className="text-emerald-700 font-bold text-sm">Annonce approuvée</p>
            <p className="text-emerald-700/80 text-xs mt-0.5 leading-snug">Elle est en ligne et visible par tous.</p>
          </div>
        </div>
      )}

      <Link
        href={`/annonce/${listingId}/edit`}
        className="w-full py-3.5 rounded-2xl bg-[#2f6fb8] text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#1a5a9e] transition-all"
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

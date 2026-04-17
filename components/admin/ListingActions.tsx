"use client";

import { useState, useTransition } from "react";
import { rejectListing, approveListing } from "@/app/admin/actions";

type Props = {
  listingId: string;
  status: string;
};

export default function ListingActions({ listingId, status }: Props) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  if (status === "REJECTED") {
    return (
      <div className="flex flex-col gap-1">
        {error && <p className="text-[10px] text-[#ba1a1a]">{error}</p>}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#ba1a1a] bg-[#ffdad6] px-2.5 py-1 rounded-full">
            <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
            Retirée
          </span>
          <button
            onClick={() => {
              setError("");
              startTransition(async () => {
                try { await approveListing(listingId); }
                catch (err) { setError(err instanceof Error ? err.message : "Erreur"); }
              });
            }}
            disabled={isPending}
            className="text-[10px] text-[#777683] hover:text-[#2f6fb8] underline underline-offset-2 disabled:opacity-50"
          >
            {isPending ? "…" : "Restaurer"}
          </button>
        </div>
      </div>
    );
  }

  if (status === "PENDING") {
    return (
      <div className="space-y-2">
        {error && <p className="text-[10px] text-[#ba1a1a]">{error}</p>}
        {!showReject ? (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setError("");
                startTransition(async () => {
                  try { await approveListing(listingId); }
                  catch (err) { setError(err instanceof Error ? err.message : "Erreur"); }
                });
              }}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2.5 py-1.5 rounded-full transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[13px]">check_circle</span>
              {isPending ? "…" : "Valider"}
            </button>
            <button
              onClick={() => setShowReject(true)}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-xs font-semibold bg-[#ffdad6] text-[#ba1a1a] hover:bg-[#ffb4ab] px-2.5 py-1.5 rounded-full transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[13px]">remove_circle</span>
              Refuser
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motif (optionnel)"
              className="text-xs border border-[#c7c5d4] rounded-lg px-2.5 py-1.5 outline-none focus:border-[#ba1a1a] w-full"
            />
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setError("");
                  startTransition(async () => {
                    try {
                      await rejectListing(listingId, reason);
                      setShowReject(false);
                      setReason("");
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Erreur");
                    }
                  });
                }}
                disabled={isPending}
                className="text-xs bg-[#ba1a1a] text-white px-2.5 py-1.5 rounded-lg font-semibold disabled:opacity-50"
              >
                {isPending ? "…" : "Confirmer"}
              </button>
              <button
                onClick={() => { setShowReject(false); setReason(""); }}
                className="text-xs text-[#777683] hover:text-[#191c1e] py-1.5"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // APPROVED — seul bouton disponible : Retirer
  return (
    <div className="space-y-2">
      {error && <p className="text-[10px] text-[#ba1a1a]">{error}</p>}

      {!showReject ? (
        <button
          onClick={() => setShowReject(true)}
          disabled={isPending}
          className="inline-flex items-center gap-1 text-xs font-semibold bg-[#ffdad6] text-[#ba1a1a] hover:bg-[#ffb4ab] px-2.5 py-1.5 rounded-full transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[13px]">remove_circle</span>
          Retirer l'annonce
        </button>
      ) : (
        <div className="flex flex-col gap-1.5">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motif (optionnel)"
            className="text-xs border border-[#c7c5d4] rounded-lg px-2.5 py-1.5 outline-none focus:border-[#ba1a1a] w-full"
          />
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setError("");
                startTransition(async () => {
                  try {
                    await rejectListing(listingId, reason);
                    setShowReject(false);
                    setReason("");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Erreur");
                  }
                });
              }}
              disabled={isPending}
              className="text-xs bg-[#ba1a1a] text-white px-2.5 py-1.5 rounded-lg font-semibold disabled:opacity-50"
            >
              {isPending ? "…" : "Confirmer"}
            </button>
            <button
              onClick={() => { setShowReject(false); setReason(""); }}
              className="text-xs text-[#777683] hover:text-[#191c1e] py-1.5"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

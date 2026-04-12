"use client";

import { useState, useTransition } from "react";
import { approveListing, rejectListing } from "@/app/admin/actions";

type Props = {
  listingId: string;
  status: string;
};

const STATUS_BADGE = {
  APPROVED: (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
      <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
      Approuvée
    </span>
  ),
  REJECTED: (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#ba1a1a] bg-[#ffdad6] px-2.5 py-1 rounded-full">
      <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
      Refusée
    </span>
  ),
};

export default function ListingActions({ listingId, status }: Props) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  if (status !== "PENDING") {
    return (
      <div className="flex items-center gap-2">
        {STATUS_BADGE[status as keyof typeof STATUS_BADGE] ?? null}
        {/* Allow re-opening moderation for non-pending */}
        <button
          onClick={() => {
            startTransition(async () => {
              if (status === "REJECTED") {
                await approveListing(listingId);
              } else {
                await rejectListing(listingId, "");
              }
            });
          }}
          disabled={isPending}
          className="text-[10px] text-[#777683] hover:text-[#15157d] underline underline-offset-2 disabled:opacity-50"
        >
          {isPending ? "…" : status === "APPROVED" ? "Retirer" : "Restaurer"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => startTransition(() => approveListing(listingId))}
          disabled={isPending}
          className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[13px]">check</span>
          {isPending ? "…" : "Valider"}
        </button>
        <button
          onClick={() => setShowReject((v) => !v)}
          disabled={isPending}
          className="inline-flex items-center gap-1 text-xs font-semibold bg-[#ffdad6] text-[#ba1a1a] hover:bg-[#ffb4ab] px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[13px]">close</span>
          Refuser
        </button>
      </div>

      {showReject && (
        <div className="flex items-start gap-1.5">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motif (optionnel)"
            className="text-xs border border-[#c7c5d4] rounded-lg px-2 py-1.5 flex-1 outline-none focus:border-[#ba1a1a]"
          />
          <button
            onClick={() => startTransition(async () => {
              await rejectListing(listingId, reason);
              setShowReject(false);
              setReason("");
            })}
            disabled={isPending}
            className="text-xs bg-[#ba1a1a] text-white px-2.5 py-1.5 rounded-lg font-semibold disabled:opacity-50 flex-shrink-0"
          >
            {isPending ? "…" : "Confirmer"}
          </button>
          <button
            onClick={() => setShowReject(false)}
            className="text-xs text-[#777683] hover:text-[#191c1e] py-1.5 flex-shrink-0"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}

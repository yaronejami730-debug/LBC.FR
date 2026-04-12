"use client";

import { useState, useTransition } from "react";
import { verifyUser, rejectUser } from "@/app/admin/actions";

type Props = {
  userId: string;
  verified: boolean;
};

export default function UserActions({ userId, verified }: Props) {
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleVerify() {
    startTransition(async () => {
      await verifyUser(userId, note || undefined);
      setShowNote(false);
      setNote("");
    });
  }

  function handleReject() {
    startTransition(async () => {
      await rejectUser(userId, note);
      setShowNote(false);
      setNote("");
    });
  }

  if (verified) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
          <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
          Vérifié
        </span>
        <button
          onClick={() => setShowNote((v) => !v)}
          className="text-xs text-[#777683] hover:text-[#ba1a1a] transition-colors underline underline-offset-2"
          disabled={isPending}
        >
          Révoquer
        </button>
        {showNote && (
          <div className="flex items-center gap-1.5 ml-1">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optionnel)"
              className="text-xs border border-[#c7c5d4] rounded-lg px-2 py-1 w-36 outline-none focus:border-[#15157d]"
            />
            <button
              onClick={handleReject}
              disabled={isPending}
              className="text-xs bg-[#ba1a1a] text-white px-2.5 py-1 rounded-lg font-semibold disabled:opacity-50"
            >
              {isPending ? "…" : "Confirmer"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <button
          onClick={handleVerify}
          disabled={isPending}
          className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[13px]">check</span>
          {isPending ? "…" : "Vérifier"}
        </button>
        <button
          onClick={() => setShowNote((v) => !v)}
          disabled={isPending}
          className="inline-flex items-center gap-1 text-xs font-semibold bg-[#ffdad6] text-[#ba1a1a] hover:bg-[#ffb4ab] px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[13px]">close</span>
          Refuser
        </button>
      </div>

      {showNote && (
        <div className="flex items-center gap-1.5">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Motif de refus (optionnel)"
            className="text-xs border border-[#c7c5d4] rounded-lg px-2 py-1 flex-1 outline-none focus:border-[#ba1a1a]"
          />
          <button
            onClick={handleReject}
            disabled={isPending}
            className="text-xs bg-[#ba1a1a] text-white px-2.5 py-1 rounded-lg font-semibold disabled:opacity-50"
          >
            {isPending ? "…" : "Confirmer"}
          </button>
          <button
            onClick={() => setShowNote(false)}
            className="text-xs text-[#777683] hover:text-[#191c1e] transition-colors"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}

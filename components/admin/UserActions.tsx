"use client";

import { useState, useTransition } from "react";
import { verifyUser, rejectUser, banUser, unbanUser } from "@/app/admin/actions";

type Props = {
  userId: string;
  verified: boolean;
  bannedAt?: string | null;
};

export default function UserActions({ userId, verified, bannedAt }: Props) {
  const [showNote, setShowNote] = useState(false);
  const [showBan, setShowBan] = useState(false);
  const [note, setNote] = useState("");
  const [banReason, setBanReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleVerify() {
    setError("");
    startTransition(async () => {
      try {
        await verifyUser(userId, note || undefined);
        setShowNote(false);
        setNote("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  }

  function handleReject() {
    setError("");
    startTransition(async () => {
      try {
        await rejectUser(userId, note);
        setShowNote(false);
        setNote("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  }

  function handleBan() {
    setError("");
    startTransition(async () => {
      try {
        await banUser(userId, banReason);
        setShowBan(false);
        setBanReason("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  }

  function handleUnban() {
    setError("");
    startTransition(async () => {
      try {
        await unbanUser(userId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      }
    });
  }

  if (bannedAt) {
    return (
      <div className="flex flex-col gap-1">
        {error && <p className="text-[10px] text-[#ba1a1a]">{error}</p>}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#ba1a1a] px-2.5 py-1 rounded-full">
            <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>block</span>
            Banni
          </span>
          <button
            onClick={handleUnban}
            disabled={isPending}
            className="text-xs text-[#777683] hover:text-emerald-700 transition-colors underline underline-offset-2 disabled:opacity-50"
          >
            {isPending ? "…" : "Lever le ban"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {error && <p className="text-[10px] text-[#ba1a1a]">{error}</p>}

      <div className="flex items-center gap-2 flex-wrap">
        {verified ? (
          <>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
              <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              Vérifié
            </span>
            <button
              onClick={() => { setShowNote((v) => !v); setShowBan(false); }}
              className="text-xs text-[#777683] hover:text-[#ba1a1a] transition-colors underline underline-offset-2"
              disabled={isPending}
            >
              Révoquer
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleVerify}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[13px]">check</span>
              {isPending ? "…" : "Vérifier"}
            </button>
            <button
              onClick={() => { setShowNote((v) => !v); setShowBan(false); }}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-xs font-semibold bg-[#ffdad6] text-[#ba1a1a] hover:bg-[#ffb4ab] px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[13px]">close</span>
              Refuser
            </button>
          </>
        )}

        <button
          onClick={() => { setShowBan((v) => !v); setShowNote(false); }}
          disabled={isPending}
          className="inline-flex items-center gap-1 text-xs font-semibold bg-gray-900 text-white hover:bg-black px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[13px]">block</span>
          Bannir
        </button>
      </div>

      {showNote && (
        <div className="flex items-center gap-1.5">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Motif (optionnel)"
            className="text-xs border border-[#c7c5d4] rounded-lg px-2 py-1 flex-1 outline-none focus:border-[#ba1a1a]"
          />
          <button
            onClick={handleReject}
            disabled={isPending}
            className="text-xs bg-[#ba1a1a] text-white px-2.5 py-1 rounded-lg font-semibold disabled:opacity-50"
          >
            {isPending ? "…" : "Confirmer"}
          </button>
          <button onClick={() => setShowNote(false)} className="text-xs text-[#777683]">Annuler</button>
        </div>
      )}

      {showBan && (
        <div className="flex flex-col gap-1.5 p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
          <p className="text-[11px] font-semibold text-gray-700">
            Ban définitif — annonces rejetées, login bloqué
          </p>
          <div className="flex items-center gap-1.5">
            <input
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Motif de ban (ex: spam, arnaque)"
              className="text-xs border border-[#c7c5d4] rounded-lg px-2 py-1 flex-1 outline-none focus:border-gray-900"
            />
            <button
              onClick={handleBan}
              disabled={isPending}
              className="text-xs bg-gray-900 text-white px-2.5 py-1 rounded-lg font-semibold disabled:opacity-50 whitespace-nowrap"
            >
              {isPending ? "…" : "Confirmer le ban"}
            </button>
            <button onClick={() => setShowBan(false)} className="text-xs text-[#777683]">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}

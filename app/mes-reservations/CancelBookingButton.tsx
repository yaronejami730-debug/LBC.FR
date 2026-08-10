"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Annulation côté client. Le serveur revérifie le délai — ce bouton n'autorise rien. */
export default function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!window.confirm("Annuler ce rendez-vous ?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/booking/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Annulation impossible");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={cancel}
        disabled={busy}
        className="rounded-full border border-rose-200 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
      >
        {busy ? "Annulation…" : "Annuler"}
      </button>
      {error && <span className="text-xs text-rose-600 self-center">{error}</span>}
    </>
  );
}

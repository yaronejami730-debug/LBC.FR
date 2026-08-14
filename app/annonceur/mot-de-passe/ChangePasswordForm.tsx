"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { COLORS, PRIMARY_GRADIENT, PRIMARY_SHADOW } from "@/lib/ads/theme";

const field =
  "w-full rounded-xl px-3.5 py-2.5 text-[14px] outline-none bg-white focus:ring-2";

export default function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vérifié aussi côté serveur ; ici c'est pour éviter un aller-retour inutile.
  const tooShort = next.length > 0 && next.length < 10;
  const mismatch = confirm.length > 0 && confirm !== next;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/advertiser/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Changement impossible");
        return;
      }
      router.push("/annonceur");
      router.refresh();
    } catch {
      setError("Connexion interrompue, réessayez");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <div>
        <label htmlFor="current" className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: COLORS.muted }}>
          {forced ? "Mot de passe temporaire" : "Mot de passe actuel"}
        </label>
        <input
          id="current"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          className={field + " mt-1"} style={{ border: `1px solid ${COLORS.line}` }}
        />
      </div>
      <div>
        <label htmlFor="next" className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: COLORS.muted }}>
          Nouveau mot de passe
        </label>
        <input
          id="next"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          className={field + " mt-1"} style={{ border: `1px solid ${COLORS.line}` }}
        />
        <p className="text-[11.5px] mt-1" style={{ color: COLORS.muted }}>10 caractères minimum.</p>
      </div>
      <div>
        <label htmlFor="confirm" className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: COLORS.muted }}>
          Confirmation
        </label>
        <input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          className={field + " mt-1"} style={{ border: `1px solid ${COLORS.line}` }}
        />
      </div>

      {tooShort && <p className="text-[13px]" style={{ color: COLORS.red }}>Mot de passe trop court.</p>}
      {mismatch && <p className="text-[13px]" style={{ color: COLORS.red }}>Les deux saisies diffèrent.</p>}
      {error && <p className="text-[13px] font-semibold" style={{ color: COLORS.red }}>{error}</p>}

      <button
        type="submit"
        disabled={busy || !current || next.length < 10 || next !== confirm}
        className="w-full rounded-xl px-6 py-3 text-[14px] font-bold text-white disabled:opacity-40"
        style={{ background: PRIMARY_GRADIENT, boxShadow: PRIMARY_SHADOW }}
      >
        {busy ? "Enregistrement…" : "Enregistrer et continuer"}
      </button>
    </form>
  );
}

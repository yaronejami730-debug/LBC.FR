"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MemberPhoto from "./MemberPhoto";

/**
 * En-tête du planning : qui je suis, où je travaille, et la sortie.
 *
 * Porte aussi le changement du mot de passe temporaire. Il est proposé, pas
 * imposé : bloquer l'accès au planning tant que le mot de passe n'a pas changé
 * priverait quelqu'un de son carnet de rendez-vous un jour de forte affluence,
 * ce qui est exactement le moment où il en a besoin.
 */
export default function MemberAgendaHeader({
  displayName,
  role,
  salon,
  avatar,
  mustChangePassword,
}: {
  displayName: string;
  role: string | null;
  salon: string;
  avatar: string | null;
  mustChangePassword: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function logout() {
    await fetch("/api/equipe/session", { method: "DELETE" });
    router.push("/equipe/connexion");
    router.refresh();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/equipe/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Changement impossible.");
        return;
      }
      setDone(true);
      setOpen(false);
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="bg-white border-b border-slate-100 mb-5">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center gap-3">
          <MemberPhoto avatar={avatar} displayName={displayName} />
          <div>
            <p className="text-xl font-extrabold font-['Manrope'] leading-tight">{displayName}</p>
            <p className="text-xs text-outline">
              {role ? `${role} · ` : ""}
              {salon}
            </p>
          </div>
          <span className="flex-1" />
          <button
            type="button"
            onClick={logout}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-on-surface-variant"
          >
            Se déconnecter
          </button>
        </div>

        {mustChangePassword && !done && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-bold text-amber-800">
              Vous utilisez le mot de passe temporaire remis par votre établissement.
            </p>
            {!open ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="mt-2 text-xs font-bold text-primary underline"
              >
                Choisir mon propre mot de passe
              </button>
            ) : (
              <form onSubmit={changePassword} className="mt-2 flex flex-wrap gap-2">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nouveau mot de passe (8 min.)"
                  className="flex-1 min-w-[200px] rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm outline-none"
                  required
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {busy ? "…" : "Enregistrer"}
                </button>
              </form>
            )}
            {error && <p className="mt-1 text-xs font-semibold text-[#ba1a1a]">{error}</p>}
          </div>
        )}

        {done && (
          <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
            Mot de passe modifié.
          </p>
        )}
      </div>
    </header>
  );
}

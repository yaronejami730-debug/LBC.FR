"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const input =
  "w-full bg-surface-container-low rounded-xl px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary/50 border border-transparent focus:border-primary/30";

/**
 * Connexion d'un membre d'équipe.
 *
 * Pas de « mot de passe oublié » : le membre n'a pas d'email chez nous, et
 * c'est la responsable du salon qui régénère son accès depuis son espace. Le
 * dire ici évite l'attente devant un lien qui n'existe pas.
 */
export default function LoginForm() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/equipe/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });
      const data = (await res.json()) as { error?: string; mustChangePassword?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Connexion impossible.");
        return;
      }
      router.push(data.mustChangePassword ? "/equipe/agenda?nouveau=1" : "/equipe/agenda");
      router.refresh();
    } catch {
      setError("Erreur réseau, réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1.5">
          Identifiant
        </label>
        <input
          className={input}
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          placeholder="corinne-4821"
          autoCapitalize="none"
          autoCorrect="off"
          required
        />
      </div>
      <div>
        <label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1.5">
          Mot de passe
        </label>
        <input
          className={input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && <p className="text-xs font-semibold text-[#ba1a1a]">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? "Connexion…" : "Voir mon planning"}
      </button>

      <p className="text-[11px] text-outline text-center leading-relaxed">
        Identifiant oublié ou perdu&nbsp;? Demandez à la personne qui gère l&apos;établissement de
        vous en générer un nouveau depuis son espace professionnel.
      </p>
    </form>
  );
}

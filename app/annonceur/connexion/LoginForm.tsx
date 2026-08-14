"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { COLORS, PRIMARY_GRADIENT, PRIMARY_SHADOW } from "@/lib/ads/theme";

const field =
  "w-full rounded-xl px-3.5 py-2.5 text-[14px] outline-none bg-white focus:ring-2";

/** Formulaire de connexion. Aucune règle ici : le serveur seul décide. */
export default function AdvertiserLoginForm() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/advertiser/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Connexion impossible");
        return;
      }
      // Le mot de passe temporaire ne donne accès qu'à son propre remplacement.
      router.push(data.mustChangePassword ? "/annonceur/mot-de-passe" : "/annonceur");
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
        <label htmlFor="loginId" className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: COLORS.muted }}>
          Identifiant
        </label>
        <input
          id="loginId"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="restaurant-le-marais-4821"
          className={field + " mt-1 font-mono"} style={{ border: `1px solid ${COLORS.line}` }}
        />
      </div>
      <div>
        <label htmlFor="password" className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: COLORS.muted }}>
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className={field + " mt-1"} style={{ border: `1px solid ${COLORS.line}` }}
        />
      </div>

      {error && <p className="text-[13px] font-semibold" style={{ color: COLORS.red }}>{error}</p>}

      <button
        type="submit"
        disabled={busy || !loginId.trim() || !password}
        className="w-full rounded-xl px-6 py-3 text-[14px] font-bold text-white disabled:opacity-40"
        style={{ background: PRIMARY_GRADIENT, boxShadow: PRIMARY_SHADOW }}
      >
        {busy ? "Connexion…" : "Se connecter"}
      </button>

      <p className="text-[12px] leading-relaxed pt-1" style={{ color: COLORS.muted }}>
        Accès perdus ? Demandez à votre interlocuteur Deal&amp;Co de vous les renvoyer : ils sont
        régénérés, jamais relus.
      </p>
    </form>
  );
}

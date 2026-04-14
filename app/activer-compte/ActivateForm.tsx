"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ActivateForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Une erreur est survenue.");
        return;
      }

      router.push("/login?activated=1");
    } catch {
      setError("Une erreur est survenue. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-on-surface mb-1.5">
          Nouveau mot de passe
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8 caractères minimum"
          required
          minLength={8}
          className="w-full px-4 py-3 rounded-2xl border border-outline-variant/30 bg-white text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-on-surface mb-1.5">
          Confirmer le mot de passe
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Répétez votre mot de passe"
          required
          className="w-full px-4 py-3 rounded-2xl border border-outline-variant/30 bg-white text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
      </div>

      {error && (
        <p className="text-red-600 text-sm font-medium bg-red-50 px-4 py-3 rounded-xl">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-60 shadow-md shadow-primary/20 active:scale-95"
      >
        {loading ? "Enregistrement…" : "Créer mon mot de passe"}
      </button>
    </form>
  );
}

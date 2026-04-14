"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Le mot de passe doit contenir au moins 8 caractères.");
    if (password !== confirm) return setError("Les mots de passe ne correspondent pas.");

    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Lien invalide ou expiré.");
      return;
    }

    router.push("/login?reset=1");
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-error font-medium">Lien invalide.</p>
        <Link href="/forgot-password" className="text-primary font-bold hover:underline mt-4 inline-block">
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="block text-sm font-bold text-primary tracking-tight">NOUVEAU MOT DE PASSE</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
          minLength={8}
          className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary outline-none"
          placeholder="Au moins 8 caractères"
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-bold text-primary tracking-tight">CONFIRMER LE MOT DE PASSE</label>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          type="password"
          required
          className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary outline-none"
          placeholder="••••••••"
        />
      </div>
      {error && (
        <p className="text-error text-sm font-medium bg-error-container px-4 py-3 rounded-xl">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-primary to-primary-container text-white font-bold py-4 rounded-full shadow-[0_8px_24px_rgba(21,21,125,0.2)] active:scale-95 transition-all disabled:opacity-70"
      >
        {loading ? "Enregistrement..." : "Enregistrer le nouveau mot de passe"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="bg-surface text-on-surface min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <img src="/logo.png" alt="Deal & Co" className="h-16 w-auto mx-auto mb-2" />
          <p className="text-on-surface-variant">Choisissez un nouveau mot de passe</p>
        </div>
        <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-[0_16px_32px_rgba(21,21,125,0.06)]">
          <Suspense>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

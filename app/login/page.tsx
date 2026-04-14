"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Email ou mot de passe incorrect");
    } else {
      // Hard redirect: ensures the session cookie is read fresh by the server
      window.location.href = searchParams.get("callbackUrl") || "/";
    }
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <img src="/logo.png" alt="Le Bon Deal" className="h-16 w-auto mx-auto mb-2" />
          <p className="text-on-surface-variant">Connectez-vous à votre compte</p>
        </div>
        <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-[0_16px_32px_rgba(21,21,125,0.06)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-primary tracking-tight">EMAIL</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary outline-none"
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-primary tracking-tight">MOT DE PASSE</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>
          <div className="text-center mt-6 space-y-2">
            <p className="text-sm text-on-surface-variant">
              <Link href="/forgot-password" className="text-primary font-bold hover:underline">
                Mot de passe oublié ?
              </Link>
            </p>
            <p className="text-sm text-on-surface-variant">
              Pas encore de compte ?{" "}
              <Link href="/register" className="text-primary font-bold hover:underline">
                Créer un compte
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

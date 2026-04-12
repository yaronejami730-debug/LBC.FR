"use client";


import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Échec de l'inscription");
    } else {
      router.push("/login");
    }
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-primary tracking-tighter font-['Manrope'] mb-2">PrèsDeToi</h1>
          <p className="text-on-surface-variant">Créez votre compte</p>
        </div>
        <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-[0_16px_32px_rgba(21,21,125,0.06)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-primary tracking-tight">NOM</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                type="text"
                required
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary outline-none"
                placeholder="Votre nom complet"
              />
            </div>
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
                minLength={6}
                className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary outline-none"
                placeholder="Min. 6 caractères"
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
              {loading ? "Création en cours..." : "Créer mon compte"}
            </button>
          </form>
          <p className="text-center mt-6 text-sm text-on-surface-variant">
            Déjà un compte ?{" "}
            <Link href="/login" className="text-primary font-bold hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setError("Une erreur est survenue. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <img src="/logo.png" alt="Deal & Co" className="h-16 w-auto mx-auto mb-2" />
          <p className="text-on-surface-variant">Réinitialisation du mot de passe</p>
        </div>

        <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-[0_16px_32px_rgba(21,21,125,0.06)]">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-3xl text-primary">mark_email_read</span>
              </div>
              <h2 className="text-xl font-bold text-on-surface">Email envoyé !</h2>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                Si un compte existe pour <strong>{email}</strong>, vous recevrez un lien de réinitialisation dans quelques minutes. Vérifiez vos spams.
              </p>
              <Link href="/login" className="block w-full bg-gradient-to-r from-primary to-primary-container text-white font-bold py-4 rounded-full text-center mt-4">
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-primary tracking-tight">VOTRE EMAIL</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary outline-none"
                  placeholder="you@example.com"
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
                {loading ? "Envoi en cours..." : "Recevoir le lien"}
              </button>
              <p className="text-center text-sm text-on-surface-variant">
                <Link href="/login" className="text-primary font-bold hover:underline">
                  Retour à la connexion
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

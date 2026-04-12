"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && (session?.user as any)?.role === "ADMIN") {
      router.replace("/admin");
    }
  }, [session, status, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", { redirect: false, email, password });

    if (res?.error) {
      setError("Email ou mot de passe incorrect");
      setLoading(false);
      return;
    }

    // Check role via session API before redirecting
    const session = await fetch("/api/auth/session").then((r) => r.json());
    if (session?.user?.role !== "ADMIN") {
      await fetch("/api/signout", { method: "POST" });
      setError("Accès refusé — ce compte n'est pas administrateur");
      setLoading(false);
      return;
    }

    window.location.href = "/admin";
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2f6fb8] mb-4">
            <span
              className="material-symbols-outlined text-white text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              admin_panel_settings
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight font-['Manrope']">
            Administration
          </h1>
          <p className="text-[#6b7280] text-sm mt-1">Le Bon Deal — accès restreint</p>
        </div>

        {/* Card */}
        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#9ca3af] uppercase tracking-widest mb-2">
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoComplete="email"
                className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-4 py-3 text-white placeholder:text-[#4b5563] focus:border-[#2f6fb8] focus:ring-1 focus:ring-[#2f6fb8] outline-none transition-colors"
                placeholder="admin@presdetoi.fr"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#9ca3af] uppercase tracking-widest mb-2">
                Mot de passe
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                autoComplete="current-password"
                className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-xl px-4 py-3 text-white placeholder:text-[#4b5563] focus:border-[#2f6fb8] focus:ring-1 focus:ring-[#2f6fb8] outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-[#2d1515] border border-[#5a1f1f] rounded-xl px-4 py-3">
                <span
                  className="material-symbols-outlined text-[#f87171] text-[18px] flex-shrink-0"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  error
                </span>
                <p className="text-[#f87171] text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2f6fb8] hover:bg-[#1a5a9e] text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Vérification…
                </>
              ) : (
                "Accéder au panneau admin"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#4b5563] mt-6">
          Réservé aux administrateurs autorisés
        </p>
      </div>
    </div>
  );
}

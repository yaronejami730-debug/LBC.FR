"use client";

/**
 * Connexion à l'administration.
 *
 * Trois choix guident cet écran.
 *
 * **Il ressemble à l'administration, pas à un sas.** L'ancienne version était
 * sombre alors que tout le panneau derrière est clair : on se connectait dans
 * un décor pour atterrir dans un autre. Le passage à `#f7f9fb`, la carte
 * blanche et le bleu `#2f6fb8` sont exactement ceux du tableau de bord.
 *
 * **Il ne dit jamais si l'e-mail existe.** Mot de passe faux, compte inconnu,
 * compte valide mais non administrateur : même phrase, même délai perçu.
 * L'ancienne version répondait « ce compte n'est pas administrateur » après une
 * authentification réussie — ce qui confirmait à l'attaquant que le couple
 * e-mail/mot de passe était bon. Sur la porte d'entrée d'un back-office, c'est
 * l'information la plus utile qu'on puisse offrir.
 *
 * **Il attend avant d'afficher quoi que ce soit.** Un administrateur déjà
 * connecté voyait le formulaire clignoter avant d'être redirigé. On ne montre
 * le champ e-mail qu'une fois la session vérifiée.
 */

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

/** Message unique, quelle que soit la raison du refus. Voir l'en-tête. */
const REFUS = "Identifiants incorrects ou compte non autorisé.";

export default function AdminLoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const isAdmin =
    status === "authenticated" &&
    (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  useEffect(() => {
    if (isAdmin) router.replace("/admin");
  }, [isAdmin, router]);

  useEffect(() => {
    if (status === "unauthenticated") emailRef.current?.focus();
  }, [status]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", { redirect: false, email, password });

    if (res?.error) {
      setError(REFUS);
      setPassword("");
      setLoading(false);
      return;
    }

    const check = await fetch("/api/auth/session").then((r) => r.json());
    if (check?.user?.role !== "ADMIN") {
      // Le compte existe et le mot de passe est bon, mais il n'a rien à faire
      // ici : on referme la session ouverte à l'instant, sans le dire.
      await fetch("/api/signout", { method: "POST" }).catch(() => {});
      setError(REFUS);
      setPassword("");
      setLoading(false);
      return;
    }

    // Navigation complète volontaire : le cookie de session vient d'être posé,
    // et le middleware doit le voir sur une requête neuve. Une transition
    // côté client marcherait aussi, mais échouerait silencieusement le jour où
    // la propagation du cookie prendrait un tour de boucle de retard.
    window.location.href = "/admin";
  }

  // Tant que la session n'est pas tranchée, rien. Voir l'en-tête.
  if (status === "loading" || isAdmin) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center">
        <span className="sr-only">Vérification de la session…</span>
        <span
          aria-hidden
          className="w-6 h-6 rounded-full border-2 border-[#dfe4e8] border-t-[#2f6fb8] motion-safe:animate-spin"
        />
      </div>
    );
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex flex-col items-center justify-center px-6 py-12">
      <main className="w-full max-w-[380px]">
        <div className="text-center mb-8">
          <Image
            src="/logo-dealco.png"
            alt="Deal &amp; Co"
            width={132}
            height={42}
            priority
            className="object-contain mx-auto mb-6 h-auto"
          />
          <h1 className="text-[22px] font-extrabold text-[#191c1e] tracking-tight font-['Manrope']">
            Administration
          </h1>
          <p className="text-[#777683] text-sm mt-1.5">Accès réservé à l&apos;équipe</p>
        </div>

        <div className="bg-white border border-[#eceef0] rounded-2xl p-7 shadow-[0_1px_2px_rgba(16,23,26,.04),0_12px_32px_-24px_rgba(16,23,26,.35)]">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label
                htmlFor="admin-email"
                className="block text-[11px] font-bold text-[#5a5b6e] uppercase tracking-[0.12em] mb-2"
              >
                Adresse e-mail
              </label>
              <input
                id="admin-email"
                ref={emailRef}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoComplete="username"
                spellCheck={false}
                aria-invalid={Boolean(error)}
                className="w-full bg-white border border-[#dfe4e8] rounded-xl px-4 py-3 text-[15px] text-[#191c1e] placeholder:text-[#a9b0b6] focus:border-[#2f6fb8] focus:ring-2 focus:ring-[#2f6fb8]/20 outline-none transition-colors"
                placeholder="vous@dealandcompany.fr"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-[11px] font-bold text-[#5a5b6e] uppercase tracking-[0.12em] mb-2"
              >
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={(e) => setCapsLock(e.getModifierState?.("CapsLock") ?? false)}
                  onBlur={() => setCapsLock(false)}
                  type={reveal ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  aria-invalid={Boolean(error)}
                  className="w-full bg-white border border-[#dfe4e8] rounded-xl pl-4 pr-12 py-3 text-[15px] text-[#191c1e] placeholder:text-[#a9b0b6] focus:border-[#2f6fb8] focus:ring-2 focus:ring-[#2f6fb8]/20 outline-none transition-colors"
                  placeholder="••••••••"
                />
                {/* Un mot de passe long se tape mal en aveugle, et le retaper
                    trois fois use plus qu'il ne protège. */}
                <button
                  type="button"
                  onClick={() => setReveal((v) => !v)}
                  aria-label={reveal ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  aria-pressed={reveal}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg text-[#8b9298] hover:text-[#2f6fb8] hover:bg-[#f2f5f7] focus-visible:ring-2 focus-visible:ring-[#2f6fb8]/40 outline-none transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {reveal ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>

              {capsLock && (
                <p className="flex items-center gap-1.5 text-[12px] text-[#9a6118] mt-2">
                  <span className="material-symbols-outlined text-[15px]">keyboard_capslock</span>
                  Verrouillage majuscules activé
                </p>
              )}
            </div>

            {/* `role="alert"` : sans lui, un lecteur d'écran ne signale rien et
                l'utilisateur reste sur un formulaire qui a l'air d'attendre. */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 bg-[#fdf2f3] border border-[#f4d3d6] rounded-xl px-4 py-3"
              >
                <span
                  aria-hidden
                  className="material-symbols-outlined text-[#99303a] text-[18px] flex-shrink-0 mt-px"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  error
                </span>
                <p className="text-[#99303a] text-[13.5px] leading-snug">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-[#2f6fb8] hover:bg-[#1a5a9e] active:scale-[.99] text-white font-bold text-[15px] py-3.5 rounded-xl transition-all disabled:opacity-45 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[#2f6fb8]/40 focus-visible:ring-offset-2 outline-none"
            >
              {loading ? (
                <>
                  <span
                    aria-hidden
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full motion-safe:animate-spin"
                  />
                  Vérification…
                </>
              ) : (
                "Se connecter"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#a9b0b6] mt-6 leading-relaxed">
          Espace réservé aux administrateurs autorisés.
        </p>
      </main>
    </div>
  );
}

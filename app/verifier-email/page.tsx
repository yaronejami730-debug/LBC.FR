"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useRef } from "react";
import Link from "next/link";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") ?? "";

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function handleDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError("");
    if (digit && index < 5) inputs.current[index + 1]?.focus();
    if (next.every(Boolean)) submitCode(next.join(""));
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(""));
      submitCode(pasted);
    }
  }

  async function submitCode(code: string) {
    if (loading) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      router.push("/login?verified=1");
    } else {
      setError(data.error ?? "Code invalide.");
      setDigits(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    }
  }

  async function handleResend() {
    if (!email || resending) return;
    setResending(true);
    await fetch("/api/verify-email/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setResending(false);
    setResent(true);
    setDigits(["", "", "", "", "", ""]);
    setError("");
    setTimeout(() => setResent(false), 5000);
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <img src="/logo.png" alt="Deal & Co" className="h-16 w-auto mx-auto mb-8" />

        <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-[0_16px_32px_rgba(21,21,125,0.06)]">
          <div className="w-14 h-14 bg-[#d5e3fc] rounded-full flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-primary text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              mark_email_unread
            </span>
          </div>

          <h1 className="text-xl font-bold text-on-surface mb-2">Vérifiez votre email</h1>
          <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
            Code envoyé à <strong className="text-on-surface">{email || "votre adresse"}</strong>.
            <br />Vérifiez aussi vos spams.
          </p>

          <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputs.current[i] = el; }}
                value={d}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                disabled={loading}
                className="w-11 h-14 text-center text-xl font-bold bg-surface-container-low rounded-xl border-2 border-transparent focus:border-primary focus:ring-0 outline-none text-on-surface transition-colors disabled:opacity-50"
              />
            ))}
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 text-sm text-primary mb-4">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Vérification…
            </div>
          )}

          {error && (
            <p className="text-error text-sm font-medium bg-error-container px-4 py-3 rounded-xl mb-4">{error}</p>
          )}

          {resent && (
            <div className="flex items-center gap-2 justify-center text-sm text-green-700 bg-green-50 px-4 py-3 rounded-xl mb-4">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              Nouveau code envoyé !
            </div>
          )}

          <button
            onClick={handleResend}
            disabled={resending || !email}
            className="text-sm text-primary font-semibold hover:underline disabled:opacity-50"
          >
            {resending ? "Envoi…" : "Renvoyer le code"}
          </button>
        </div>

        <p className="mt-6 text-sm text-on-surface-variant">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-primary font-bold hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}

"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const expired = searchParams.get("expired") === "1";
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleResend() {
    if (!email || loading) return;
    setLoading(true);
    await fetch("/api/verify-email/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="bg-surface text-on-surface min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <img src="/logo.png" alt="Deal & Co" className="h-16 w-auto mx-auto mb-6" />
          <div className="w-16 h-16 bg-[#d5e3fc] rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-primary text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              mark_email_unread
            </span>
          </div>
          <h1 className="text-2xl font-bold text-on-surface mb-3">
            {expired ? "Lien expiré" : "Vérifiez votre email"}
          </h1>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            {expired
              ? "Votre lien de confirmation a expiré. Cliquez ci-dessous pour en recevoir un nouveau."
              : <>
                  Un email de confirmation a été envoyé à{" "}
                  {email && <strong className="text-on-surface">{email}</strong>}.{" "}
                  Cliquez sur le lien dans l&apos;email pour activer votre compte.
                </>
            }
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-[0_16px_32px_rgba(21,21,125,0.06)] space-y-4">
          {sent ? (
            <div className="flex items-center gap-2 justify-center text-sm text-green-700 bg-green-50 px-4 py-3 rounded-xl">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              Email renvoyé ! Vérifiez votre boîte de réception.
            </div>
          ) : (
            <button
              onClick={handleResend}
              disabled={loading || !email}
              className="w-full bg-gradient-to-r from-primary to-primary-container text-white font-bold py-4 rounded-full shadow-[0_8px_24px_rgba(21,21,125,0.2)] active:scale-95 transition-all disabled:opacity-70"
            >
              {loading ? "Envoi en cours…" : "Renvoyer l'email de confirmation"}
            </button>
          )}

          <p className="text-xs text-on-surface-variant">
            Vérifiez aussi vos spams si vous ne trouvez pas l&apos;email.
          </p>
        </div>

        <p className="mt-8 text-sm text-on-surface-variant">
          Déjà un compte vérifié ?{" "}
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ConsentState = "granted" | "denied";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const COOKIE_NAME = "consent_v1";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 390; // 13 months — CNIL max

function readConsent(): ConsentState | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  if (!match) return null;
  const v = decodeURIComponent(match[1]);
  return v === "granted" || v === "denied" ? v : null;
}

function writeConsent(state: ConsentState) {
  document.cookie = `${COOKIE_NAME}=${state}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax; Secure`;
}

function applyConsent(state: ConsentState) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  const gtag = (...args: unknown[]) => window.dataLayer!.push(args);
  gtag("consent", "update", {
    ad_storage: state,
    ad_user_data: state,
    ad_personalization: state,
    analytics_storage: state,
  });
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (readConsent() === null) setVisible(true);
  }, []);

  if (!visible) return null;

  function choose(state: ConsentState) {
    writeConsent(state);
    applyConsent(state);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Consentement aux cookies"
      className="fixed inset-x-0 bottom-0 z-[200] p-4 md:p-6 pointer-events-none"
    >
      <div className="max-w-3xl mx-auto bg-white border border-slate-200 shadow-2xl rounded-2xl p-5 md:p-6 pointer-events-auto">
        <h2 className="text-base font-extrabold text-on-surface mb-2">Cookies et données</h2>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          Nous utilisons des cookies pour mesurer l&apos;audience (Google Analytics) et afficher
          des publicités pertinentes (Google AdSense). Vous pouvez les accepter ou les refuser.
          Votre choix est conservé 13 mois.{" "}
          <Link href="/confidentialite" className="text-primary font-semibold underline">
            En savoir plus
          </Link>
          .
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => choose("denied")}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-on-surface font-bold text-sm transition-colors"
          >
            Tout refuser
          </button>
          <button
            type="button"
            onClick={() => choose("granted")}
            className="flex-1 py-3 px-4 rounded-xl bg-primary hover:bg-[#2560a0] text-white font-bold text-sm transition-colors"
          >
            Tout accepter
          </button>
        </div>
      </div>
    </div>
  );
}

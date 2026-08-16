"use client";

/**
 * Bandeau de consentement aux cookies.
 *
 * Trois défauts le faisaient réapparaître à chaque rechargement.
 *
 * **Le cookie n'était pas écrit hors HTTPS.** L'attribut `Secure` était posé en
 * dur ; sur une origine en clair — le développement local par l'adresse du
 * réseau local, notamment — le navigateur rejette l'écriture sans rien dire. Le
 * choix n'était donc jamais enregistré, et le bandeau revenait indéfiniment.
 *
 * **Safari effaçait le cookie au bout de 7 jours.** Sa protection anti-pistage
 * plafonne tout cookie écrit en JavaScript, quelle que soit la durée demandée.
 * L'écriture passe désormais par `POST /api/consent`, dont l'en-tête
 * `Set-Cookie` échappe à cette limite et tient les 13 mois annoncés.
 *
 * `localStorage` sert de filet : si le cookie disparaît malgré tout — purge de
 * navigateur, quota, expiration imprévue — le choix y est relu et le cookie
 * reposé en silence, sans que le visiteur ait à répondre une seconde fois.
 *
 * La lecture reste volontairement côté navigateur. La faire côté serveur
 * supprimerait le bref instant où le bandeau peut apparaître, mais appeler
 * `cookies()` dans le layout racine ferait basculer tout le site en rendu
 * dynamique : ce serait payer la génération statique de toutes les pages SEO
 * pour gagner quelques millisecondes d'affichage.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  isConsentState,
  type ConsentState,
} from "@/lib/consent";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const STORAGE_KEY = CONSENT_COOKIE;

function readCookie(): ConsentState | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
  if (!match) return null;
  const value = decodeURIComponent(match[1]);
  return isConsentState(value) ? value : null;
}

function readStorage(): ConsentState | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isConsentState(value) ? value : null;
  } catch {
    // Navigation privée ou stockage refusé : ce n'est pas une erreur, juste un
    // filet indisponible.
    return null;
  }
}

/**
 * Écriture immédiate côté navigateur, pour que le bandeau ne puisse pas
 * revenir entre le clic et la réponse du serveur. Le serveur repose ensuite le
 * même cookie avec une durée que Safari ne rognera pas.
 */
function writeLocally(state: ConsentState): void {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${state}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  try {
    localStorage.setItem(STORAGE_KEY, state);
  } catch {
    /* stockage indisponible — le cookie suffit */
  }
}

function persist(state: ConsentState): void {
  fetch("/api/consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: state }),
    keepalive: true,
  }).catch(() => {
    /* hors ligne : le cookie navigateur a déjà été posé */
  });
}

function applyConsent(state: ConsentState): void {
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
    // Choix déjà connu — par le cookie, ou par le filet `localStorage` si le
    // cookie a disparu. On le rétablit en silence plutôt que de reposer la
    // question, et le bandeau ne s'affiche jamais.
    const known = readCookie() ?? readStorage();
    if (known) {
      writeLocally(known);
      persist(known);
      applyConsent(known);
      return;
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  function choose(state: ConsentState) {
    writeLocally(state);
    persist(state);
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

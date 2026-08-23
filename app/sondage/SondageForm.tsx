"use client";

import { useState } from "react";
import { ATTRIBUTION_SOURCES } from "@/lib/attribution-sources";

/**
 * Le questionnaire lui-même : un choix, un envoi.
 *
 * Le choix arrive déjà coché quand la personne vient d'un bouton de l'e-mail :
 * il ne reste qu'à confirmer. C'est le compromis retenu contre les antivirus de
 * messagerie, qui ouvrent tous les liens d'un message — voir
 * `app/api/attribution/route.ts`.
 */
export default function SondageForm({
  token,
  preselected,
  alreadyAnswered,
}: {
  token: string;
  preselected?: string | null;
  alreadyAnswered?: string | null;
}) {
  const [choice, setChoice] = useState<string | null>(preselected ?? alreadyAnswered ?? null);
  const [detail, setDetail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    alreadyAnswered && !preselected ? "done" : "idle",
  );

  const needsDetail = ATTRIBUTION_SOURCES.find((s) => s.key === choice)?.askDetail === true;

  async function submit() {
    if (!choice) return;
    setState("sending");
    try {
      const res = await fetch("/api/attribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, source: choice, detail: needsDetail ? detail : null }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-[#eceef0] bg-white p-8 text-center">
        <span className="material-symbols-outlined text-[36px] text-[#2f6fb8]">check_circle</span>
        <h1 className="mt-2 text-xl font-extrabold text-[#191c1e]">Merci, c&apos;est noté</h1>
        <p className="mt-1 text-sm text-[#777683]">
          Votre réponse nous dit où concentrer nos efforts. Vous pouvez la modifier en revenant sur
          cette page.
        </p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="mt-4 text-sm font-bold text-[#2f6fb8] underline"
        >
          Changer ma réponse
        </button>
        <div className="mt-6">
          <a
            href="/"
            className="inline-block rounded-full bg-[#2f6fb8] px-6 py-3 text-sm font-bold text-white"
          >
            Retour à Deal &amp; Co
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#eceef0] bg-white p-6 sm:p-8">
      <h1 className="text-xl font-extrabold text-[#191c1e]">Comment nous avez-vous connus ?</h1>
      <p className="mt-1 text-sm text-[#777683]">
        Une seule réponse, et elle nous sert vraiment : nos statistiques ne voient que le dernier
        clic, jamais ce qui vous a fait venir la première fois.
      </p>

      <div className="mt-5 flex flex-col gap-2">
        {ATTRIBUTION_SOURCES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setChoice(s.key)}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
              choice === s.key
                ? "border-[#2f6fb8] bg-[#eef4fb] text-[#2f6fb8]"
                : "border-[#eceef0] bg-white text-[#191c1e] hover:border-[#c7c5d4]"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${
                choice === s.key ? "text-[#2f6fb8]" : "text-[#c7c5d4]"
              }`}
            >
              {choice === s.key ? "radio_button_checked" : "radio_button_unchecked"}
            </span>
            {s.label}
          </button>
        ))}
      </div>

      {needsDetail && (
        <input
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          maxLength={200}
          placeholder="Où exactement ? (facultatif)"
          className="mt-3 w-full rounded-xl border border-[#eceef0] px-4 py-3 text-sm outline-none focus:border-[#2f6fb8]"
        />
      )}

      {state === "error" && (
        <p className="mt-3 text-sm font-semibold text-[#ba1a1a]">
          L&apos;enregistrement a échoué. Réessayez dans un instant.
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!choice || state === "sending"}
        className="mt-5 w-full rounded-full bg-[#2f6fb8] px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {state === "sending" ? "Envoi…" : "Envoyer ma réponse"}
      </button>
    </div>
  );
}

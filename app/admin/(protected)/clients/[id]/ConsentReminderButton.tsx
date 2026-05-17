"use client";

import { useState, useTransition } from "react";
import { sendConsentReminderToUser } from "@/app/admin/actions";

/**
 * Bouton admin pour relancer un utilisateur n'ayant pas accepté les CGU
 * ni la politique de confidentialité. Désactivé si déjà accepté ou banni.
 * Affiche le statut de l'action (succès / erreur / déjà relancé sous 24h).
 */
export default function ConsentReminderButton({
  userId,
  consentGiven,
  banned,
}: {
  userId: string;
  consentGiven: boolean;
  banned: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  if (consentGiven || banned) return null;

  function handleClick() {
    setMsg(null);
    startTransition(async () => {
      try {
        await sendConsentReminderToUser(userId);
        setMsg({ kind: "ok", text: "Relance envoyée." });
      } catch (err) {
        setMsg({
          kind: "err",
          text: err instanceof Error ? err.message : "Échec de la relance.",
        });
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-800 hover:bg-amber-200 px-2.5 py-1 rounded-full transition-colors disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-[14px]">mail</span>
        {isPending ? "Envoi…" : "Relancer CGU"}
      </button>
      {msg && (
        <span
          className={`text-[11px] font-semibold ${
            msg.kind === "ok" ? "text-emerald-700" : "text-[#ba1a1a]"
          }`}
        >
          {msg.text}
        </span>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { setUserRole } from "./actions";

/**
 * Ajout ou retrait d'un administrateur par son email.
 *
 * Volontairement minimal : on ne crée pas de compte ici, on élève un compte
 * existant. Un modérateur doit d'abord s'inscrire normalement.
 */
export default function ModeratorForm() {
  const [email, setEmail] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run(role: "ADMIN" | "USER") {
    setMsg(null);
    start(async () => {
      const res = await setUserRole(email, role).catch((e) => ({
        ok: false as const,
        error: e instanceof Error ? e.message : "Action impossible",
      }));
      if (res.ok) {
        setMsg({
          ok: true,
          text: role === "ADMIN" ? `${email} est désormais administrateur.` : `Rôle retiré à ${email}.`,
        });
        setEmail("");
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <div className="bg-white border border-[#eceef0] rounded-2xl p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
        Ajouter un modérateur
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email du compte à promouvoir"
          className="flex-1 min-w-[220px] rounded-xl border border-[#eceef0] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/20"
        />
        <button
          type="button"
          disabled={pending || !email.includes("@")}
          onClick={() => run("ADMIN")}
          className="rounded-full bg-[#2f6fb8] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          Nommer administrateur
        </button>
        <button
          type="button"
          disabled={pending || !email.includes("@")}
          onClick={() => run("USER")}
          className="rounded-full border border-[#eceef0] px-5 py-2.5 text-sm font-bold text-slate-500 hover:border-rose-200 hover:text-rose-700 disabled:opacity-40"
        >
          Retirer le rôle
        </button>
      </div>
      {msg && (
        <p className={`mt-2 text-sm font-semibold ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

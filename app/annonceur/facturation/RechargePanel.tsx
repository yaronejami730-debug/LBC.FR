"use client";

import { useState } from "react";
import { COLORS, PRIMARY_GRADIENT, PRIMARY_SHADOW } from "@/lib/ads/theme";

/** Montants proposés, en euros hors taxes. */
const PRESETS = [50, 100, 250, 500, 1000];
const VAT = 0.2;

/**
 * Recharge du portefeuille.
 *
 * Les montants sont annoncés HT **et** TTC : la publicité se consomme en HT,
 * mais c'est le TTC qui sera débité. Ne montrer qu'un seul des deux produit
 * systématiquement un appel au support.
 */
export default function RechargePanel({ configured }: { configured: boolean }) {
  const [amount, setAmount] = useState(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ttc = Math.round(amount * 100 * (1 + VAT)) / 100;

  async function recharge() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/advertiser/wallet/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: Math.round(amount * 100) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(data.error ?? "Recharge indisponible");
        return;
      }
      window.location.href = data.url as string;
    } catch {
      setError("Connexion interrompue, réessayez");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(p)}
            className="rounded-xl px-4 py-2.5 text-[13.5px] font-bold tabular-nums"
            style={
              amount === p
                ? { border: `1px solid ${COLORS.blue}`, background: COLORS.tint, color: COLORS.blue }
                : { border: `1px solid ${COLORS.line}`, color: COLORS.soft, background: "#fff" }
            }
          >
            {p} € HT
          </button>
        ))}
        <label className="flex items-center gap-2">
          <span className="sr-only">Autre montant</span>
          <input
            type="number"
            min={20}
            max={5000}
            step={10}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
            className="w-28 rounded-xl px-3 py-2.5 text-[13.5px] tabular-nums outline-none bg-white"
            style={{ border: `1px solid ${COLORS.line}` }}
          />
          <span className="text-[12.5px]" style={{ color: COLORS.muted }}>€ HT</span>
        </label>
      </div>

      <p className="mt-3 text-[13px]" style={{ color: COLORS.soft }}>
        À payer : <strong className="tabular-nums">{ttc.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} TTC</strong>{" "}
        <span style={{ color: COLORS.muted }}>(TVA {Math.round(VAT * 100)} %)</span>. Une facture est
        émise automatiquement.
      </p>

      {error && (
        <p className="mt-2 text-[13px] font-semibold" style={{ color: COLORS.red }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={recharge}
        disabled={busy || !configured || amount < 20}
        className="mt-3 rounded-xl px-6 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50"
        style={{ background: PRIMARY_GRADIENT, boxShadow: PRIMARY_SHADOW }}
      >
        {busy ? "Ouverture du paiement…" : "Recharger"}
      </button>

      {!configured && (
        <p className="mt-2 text-[12.5px]" style={{ color: COLORS.muted }}>
          Le paiement en ligne n&apos;est pas encore ouvert. Votre interlocuteur Deal&amp;Co peut
          créditer votre compte en attendant.
        </p>
      )}
    </div>
  );
}

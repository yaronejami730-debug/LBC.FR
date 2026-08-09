"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Bouton d'abonnement à un vendeur.
 *
 * Bascule optimiste : l'état change au clic, le serveur suit. Un visiteur non
 * connecté est envoyé se connecter et revient sur la fiche du vendeur.
 */
export default function SubscribeButton({
  sellerId,
  sellerName,
  initialSubscribed,
  initialCount,
  isLoggedIn,
}: {
  sellerId: string;
  sellerName: string;
  initialSubscribed: boolean;
  initialCount: number;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [count, setCount] = useState(initialCount);
  const [pending, start] = useTransition();

  function toggle() {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=/u/${sellerId}`);
      return;
    }

    const next = !subscribed;
    setSubscribed(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));

    start(async () => {
      try {
        const res = await fetch("/api/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sellerId }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSubscribed(data.subscribed);
      } catch {
        setSubscribed(!next);
        setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        title={subscribed ? `Se désabonner de ${sellerName}` : `S'abonner à ${sellerName}`}
        className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all active:scale-95 disabled:opacity-60 ${
          subscribed
            ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
            : "bg-primary text-white shadow-sm hover:opacity-90"
        }`}
      >
        <span
          className="material-symbols-outlined text-[18px]"
          style={subscribed ? { fontVariationSettings: "'FILL' 1" } : {}}
        >
          {subscribed ? "notifications_active" : "notifications"}
        </span>
        {subscribed ? "Abonné" : "S'abonner"}
      </button>
      <span className="text-xs text-outline">
        {count.toLocaleString("fr-FR")} abonné{count > 1 ? "s" : ""}
      </span>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RepublishButton({ listingId }: { listingId: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handleRepublish() {
    setLoading(true);
    const res = await fetch(`/api/listings/${listingId}/republish`, { method: "POST" });
    setLoading(false);
    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push(`/annonce/${listingId}`), 1500);
    }
  }

  if (done) {
    return (
      <div className="w-full bg-emerald-50 text-emerald-700 font-bold py-4 rounded-full text-center flex items-center justify-center gap-2">
        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        Annonce republiée !
      </div>
    );
  }

  return (
    <button
      onClick={handleRepublish}
      disabled={loading}
      className="w-full bg-gradient-to-r from-primary to-primary-container text-white font-bold py-4 rounded-full shadow-[0_8px_24px_rgba(21,21,125,0.2)] active:scale-95 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
    >
      <span className="material-symbols-outlined text-[18px]">refresh</span>
      {loading ? "Publication…" : "Republier l'annonce"}
    </button>
  );
}

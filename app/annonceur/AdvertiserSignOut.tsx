"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Sortie de l'espace annonceur. */
export default function AdvertiserSignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/advertiser/session", { method: "DELETE" }).catch(() => {});
        router.push("/annonceur/connexion");
        router.refresh();
      }}
      title="Se déconnecter"
      className="w-[38px] h-[38px] rounded-xl grid place-items-center disabled:opacity-50"
      style={{ border: "1px solid #EDF1FA", background: "#fff", color: "#475569" }}
    >
      <span className="material-symbols-outlined text-[16px]">{busy ? "hourglass_empty" : "logout"}</span>
    </button>
  );
}

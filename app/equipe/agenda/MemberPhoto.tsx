"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Photo de profil, posée par le membre lui-même.
 *
 * Elle sert deux fois : la pastille de l'agenda du salon, et la vignette que
 * voit le client au moment de choisir son praticien. C'est donc son visage à
 * elle qui est en jeu — la responsable peut la mettre le premier jour depuis
 * `Équipe et horaires`, mais la personne doit pouvoir la remplacer sans
 * demander la permission.
 *
 * Le recadrage carré est fait côté serveur : une photo prise au téléphone est
 * verticale, et la rogner ici obligerait à embarquer un éditeur d'image dans
 * un écran qu'on consulte entre deux clientes.
 */
export default function MemberPhoto({
  avatar,
  displayName,
}: {
  avatar: string | null;
  displayName: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(avatar);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/equipe/photo", { method: "POST", body: form });
      const data = (await res.json()) as { avatar?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Envoi impossible");
        return;
      }
      setCurrent(data.avatar ?? null);
      router.refresh();
    } catch {
      setError("Erreur réseau, réessayez");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/equipe/photo", { method: "DELETE" });
      if (res.ok) {
        setCurrent(null);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        title={current ? "Remplacer ma photo" : "Ajouter ma photo"}
        aria-label={current ? "Remplacer ma photo" : "Ajouter ma photo"}
        className="relative w-14 h-14 rounded-full overflow-hidden bg-surface-container-low grid place-items-center shrink-0 disabled:opacity-50"
      >
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-base font-extrabold text-outline">{initials}</span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-black/45 text-white text-[9px] font-bold py-0.5">
          {busy ? "…" : "Photo"}
        </span>
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />

      {current && !busy && (
        <button
          type="button"
          onClick={remove}
          className="text-[11px] font-bold text-outline underline"
          title="Retirer ma photo"
        >
          Retirer
        </button>
      )}
      {error && <span className="text-[11px] font-semibold text-[#ba1a1a]">{error}</span>}
    </div>
  );
}

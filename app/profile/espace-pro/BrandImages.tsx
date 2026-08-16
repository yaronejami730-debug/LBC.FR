"use client";

import { useRef, useState } from "react";

/**
 * Aperçu de la fiche : couverture, cadrage, logo.
 *
 * Les dimensions sont annoncées **avant** l'envoi, pas après : un
 * professionnel qui découvre son bandeau rogné une fois publié ne recommence
 * généralement pas, il laisse une fiche bancale.
 *
 * Le cadrage existe parce qu'une photo de devanture est prise en 4:3 ou 3:2,
 * alors que le bandeau est en 16:5. Sans réglage, le recadrage automatique
 * coupe au centre et décapite l'enseigne une fois sur deux. On déplace donc la
 * photo à la souris, on l'agrandit au curseur, et l'aperçu est le rendu réel —
 * même ratio, même recadrage, même rond par-dessus.
 */

const COVER = { w: 1600, h: 500, ratio: "16 / 5" };
const LOGO = { w: 512, h: 512 };
const MAX_BYTES = 8 * 1024 * 1024;

export type Framing = { coverX: number; coverY: number; coverZoom: number };

type Props = {
  coverImage: string | null;
  avatar: string | null;
  framing: Framing;
  monogram: string;
  onChange: (next: { coverImage?: string | null; avatar?: string | null } & Partial<Framing>) => void;
};

export default function BrandImages({ coverImage, avatar, framing, monogram, onChange }: Props) {
  const [busy, setBusy] = useState<"cover" | "logo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  async function upload(file: File, kind: "cover" | "logo") {
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Choisissez une image (JPEG, PNG ou WebP).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`Image trop lourde (${Math.round(file.size / 1024 / 1024)} Mo). Maximum 8 Mo.`);
      return;
    }

    // On mesure avant d'envoyer : prévenir sur une image trop petite coûte une
    // seconde, la republier après coup coûte une visite de plus.
    const tooSmall = await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const min = kind === "cover" ? COVER.w : LOGO.w;
        resolve(
          img.naturalWidth < min
            ? `Image un peu petite (${img.naturalWidth} px de large). ${min} px recommandés — elle risque d'être floue.`
            : null,
        );
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(file);
    });

    setBusy(kind);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("usage", "brand");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? `Erreur ${res.status}`);

      if (kind === "cover") {
        // Nouvelle photo, cadrage remis au centre : conserver le réglage de la
        // précédente donnerait un cadrage aberrant sur une image différente.
        onChange({ coverImage: data.url, coverX: 50, coverY: 50, coverZoom: 1 });
      } else {
        // Le logo est l'avatar du compte professionnel : c'est lui que la fiche
        // publique affiche dans le rond, et lui qui suit le compte partout
        // ailleurs (annonces, messages). Une seule image à tenir à jour.
        const r = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatar: data.url }),
        });
        const rd = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(rd.error ?? "Le logo n'a pas pu être enregistré.");
        onChange({ avatar: data.url });
      }

      if (tooSmall) setError(tooSmall);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setBusy(null);
    }
  }

  /**
   * Déplacement du cadrage à la souris ou au doigt.
   *
   * On raisonne en pourcentage d'`object-position` : un déplacement d'un quart
   * de la largeur du cadre décale l'image d'un quart de sa marge disponible.
   * C'est approximatif au pixel près, mais c'est ce qui donne la sensation
   * d'attraper la photo — le rendu exact est sous les yeux de l'utilisateur.
   */
  function startDrag(clientX: number, clientY: number) {
    if (!coverImage) return;
    const box = frameRef.current?.getBoundingClientRect();
    if (!box) return;

    setDragging(true);
    const origin = { x: clientX, y: clientY, cx: framing.coverX, cy: framing.coverY };

    const move = (x: number, y: number) => {
      const dx = ((x - origin.x) / box.width) * 100;
      const dy = ((y - origin.y) / box.height) * 100;
      onChange({
        coverX: Math.min(100, Math.max(0, origin.cx - dx)),
        coverY: Math.min(100, Math.max(0, origin.cy - dy)),
      });
    };

    const onMouseMove = (e: MouseEvent) => move(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) move(t.clientX, t.clientY);
    };
    const stop = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchend", stop);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchend", stop);
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight font-['Manrope']">Aperçu de la fiche</h2>
        <p className="text-xs text-outline mt-1">
          Exactement ce que vos clients verront en haut de votre page publique.
        </p>
      </div>

      {/* ── Aperçu : bandeau + rond, à la taille réelle ────────────────── */}
      <div>
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <label className="text-[10px] text-outline uppercase font-bold tracking-wider">
            Photo de couverture
          </label>
          <span className="text-[11px] text-outline tabular-nums">
            {COVER.w} × {COVER.h} px · 8 Mo max
          </span>
        </div>

        <div
          ref={frameRef}
          onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (t) startDrag(t.clientX, t.clientY);
          }}
          className={`relative w-full rounded-xl overflow-hidden bg-gradient-to-br from-primary to-[#1a5a9e] border border-slate-200 select-none ${
            coverImage ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""
          }`}
          style={{ aspectRatio: COVER.ratio }}
        >
          {coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImage}
              alt="Aperçu de la couverture"
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                objectPosition: `${framing.coverX}% ${framing.coverY}%`,
                transform: `scale(${framing.coverZoom})`,
              }}
            />
          )}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/35 to-transparent" />

          {coverImage && (
            <p className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[11px] font-bold text-white pointer-events-none">
              Faites glisser pour recadrer
            </p>
          )}
        </div>

        {/* Le rond, à sa taille et à sa place réelles : c'est lui qui masque le
            coin bas-gauche de la photo, et beaucoup y placent leur enseigne. */}
        <div className="relative h-0">
          <div className="absolute left-6 -top-14 h-28 w-28 rounded-full border-4 border-white bg-white shadow-[0_6px_20px_rgba(21,21,125,0.14)] overflow-hidden grid place-items-center">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="Aperçu du logo" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-extrabold text-primary font-['Manrope']">
                {monogram || "?"}
              </span>
            )}
          </div>
        </div>

        <div className="pt-16">
          {coverImage && (
            <label className="block">
              <span className="text-[10px] text-outline uppercase font-bold tracking-wider">
                Zoom
              </span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={framing.coverZoom}
                onChange={(e) => onChange({ coverZoom: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </label>
          )}

          <p className="text-[11px] text-outline mt-1">
            Évitez de placer du texte en bas à gauche : le logo s&apos;y superpose.
          </p>

          <div className="flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              onClick={() => coverInput.current?.click()}
              disabled={busy !== null}
              className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy === "cover" ? "Envoi…" : coverImage ? "Remplacer la couverture" : "Ajouter une couverture"}
            </button>
            {coverImage && (
              <>
                <button
                  type="button"
                  onClick={() => onChange({ coverX: 50, coverY: 50, coverZoom: 1 })}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-on-surface-variant"
                >
                  Recentrer
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ coverImage: null })}
                  disabled={busy !== null}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-on-surface-variant disabled:opacity-50"
                >
                  Retirer
                </button>
              </>
            )}
          </div>
        </div>

        <input
          ref={coverInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) upload(f, "cover");
          }}
        />
      </div>

      {/* ── Logo ───────────────────────────────────────────────────── */}
      <div className="pt-4 border-t border-slate-100">
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <label className="text-[10px] text-outline uppercase font-bold tracking-wider">Logo</label>
          <span className="text-[11px] text-outline tabular-nums">
            {LOGO.w} × {LOGO.h} px · carré · 8 Mo max
          </span>
        </div>
        <p className="text-[11px] text-outline mb-2">
          Affiché dans un rond : centrez votre enseigne, les angles seront coupés.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-20 w-20 shrink-0 rounded-full border border-slate-200 bg-surface-container-low overflow-hidden grid place-items-center">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="Logo actuel" className="h-full w-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-[24px] text-outline">storefront</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => logoInput.current?.click()}
            disabled={busy !== null}
            className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy === "logo" ? "Envoi…" : avatar ? "Remplacer le logo" : "Ajouter un logo"}
          </button>
        </div>
        <input
          ref={logoInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) upload(f, "logo");
          }}
        />
      </div>

      {error && <p className="text-xs font-semibold text-[#ba1a1a]">{error}</p>}
    </section>
  );
}

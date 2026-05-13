"use client";

import { useState } from "react";
import Image from "next/image";

type Props = {
  images: string[];
  onChange: (next: string[]) => void;
  maxPhotos?: number;
  /** "compact" = small (used in card edit forms). "comfortable" = larger (used in main listing form). */
  size?: "compact" | "comfortable";
};

/**
 * Drag-and-drop photo grid with arrow-button fallback for touch devices.
 * Position 1 (index 0) is the cover photo shown in search results.
 */
export default function PhotoSortableGrid({
  images,
  onChange,
  maxPhotos = 15,
  size = "comfortable",
}: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function move(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= images.length || to >= images.length) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  function remove(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function shift(index: number, dir: -1 | 1) {
    move(index, index + dir);
  }

  // ── Drag handlers ──
  function onDragStart(e: React.DragEvent, index: number) {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }
  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overIndex !== index) setOverIndex(index);
  }
  function onDragLeave() {
    setOverIndex(null);
  }
  function onDrop(e: React.DragEvent, index: number) {
    e.preventDefault();
    const from = Number(e.dataTransfer.getData("text/plain"));
    setDragIndex(null);
    setOverIndex(null);
    if (!Number.isNaN(from)) move(from, index);
  }
  function onDragEnd() {
    setDragIndex(null);
    setOverIndex(null);
  }

  if (images.length === 0) return null;

  const cellCls =
    size === "compact"
      ? "aspect-square rounded-lg"
      : "aspect-square rounded-xl";

  return (
    <div className={`grid gap-2 ${size === "compact" ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-4"}`}>
      {images.map((src, i) => {
        const isDragging = dragIndex === i;
        const isOver = overIndex === i && dragIndex !== i;
        return (
          <div
            key={`${src}-${i}`}
            draggable
            onDragStart={(e) => onDragStart(e, i)}
            onDragOver={(e) => onDragOver(e, i)}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDrop(e, i)}
            onDragEnd={onDragEnd}
            className={`relative ${cellCls} overflow-hidden bg-slate-100 group cursor-grab active:cursor-grabbing transition-all ${
              isDragging ? "opacity-30 scale-95" : ""
            } ${isOver ? "ring-2 ring-[#2f6fb8] ring-offset-2 scale-[1.03]" : ""}`}
            title="Glissez pour réordonner"
          >
            <Image
              src={src}
              alt={`Photo ${i + 1}`}
              fill
              sizes="120px"
              className="object-cover pointer-events-none"
              draggable={false}
            />

            {/* Position badge */}
            <span className={`absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${
              i === 0 ? "bg-[#2f6fb8] text-white" : "bg-black/60 text-white"
            }`}>
              {i === 0 ? "1ère" : i + 1}
            </span>

            {/* Drag handle hint */}
            <span className="absolute top-1 right-1 w-5 h-5 rounded bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="material-symbols-outlined text-[12px]">drag_indicator</span>
            </span>

            {/* Bottom controls (visible on hover for desktop, always for touch) */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity touch:opacity-100">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => shift(i, -1)}
                  disabled={i === 0}
                  aria-label="Déplacer vers la gauche"
                  className="w-6 h-6 rounded bg-white/90 text-[#191c1e] flex items-center justify-center disabled:opacity-30 hover:bg-white"
                >
                  <span className="material-symbols-outlined text-[14px]">chevron_left</span>
                </button>
                <button
                  type="button"
                  onClick={() => shift(i, 1)}
                  disabled={i === images.length - 1}
                  aria-label="Déplacer vers la droite"
                  className="w-6 h-6 rounded bg-white/90 text-[#191c1e] flex items-center justify-center disabled:opacity-30 hover:bg-white"
                >
                  <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Supprimer la photo"
                className="w-6 h-6 rounded bg-red-500/90 text-white flex items-center justify-center hover:bg-red-500"
              >
                <span className="material-symbols-outlined text-[14px]">delete</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";

interface PhotoGalleryProps {
  images: string[];
  title: string;
}

/** Cell with blurred backdrop + full image + logo */
function PhotoCell({
  src,
  alt,
  onClick,
  badge,
  overlay,
}: {
  src: string;
  alt: string;
  onClick: () => void;
  badge?: React.ReactNode;
  overlay?: React.ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden cursor-pointer group rounded-xl bg-slate-200"
      onClick={onClick}
    >
      {/* Photo — cover pour remplir la cellule sans zone noire */}
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
      {/* Logo — bottom-left of each cell */}
      <div className="absolute bottom-3 left-3 z-20 pointer-events-none select-none">
        <img
          src="/logo.png"
          alt=""
          className="h-5 md:h-6 w-auto brightness-0 invert opacity-60 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"
        />
      </div>
      {badge}
      {overlay}
    </div>
  );
}

export default function PhotoGallery({ images, title }: PhotoGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const openLightbox = (index: number) => { setCurrentIndex(index); setLightboxOpen(true); };
  const closeLightbox = () => setLightboxOpen(false);

  const goNext = useCallback(() => setCurrentIndex((i) => (i + 1) % images.length), [images.length]);
  const goPrev = useCallback(() => setCurrentIndex((i) => (i - 1 + images.length) % images.length), [images.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, goNext, goPrev]);

  useEffect(() => {
    document.body.style.overflow = lightboxOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [lightboxOpen]);

  const extraCount = images.length - 3;

  return (
    <>
      {/* ── Gallery Grid ── */}
      <div className="grid grid-cols-3 gap-2 h-[260px] md:h-[440px]">
        {images.slice(0, 3).map((img, i) => (
          <PhotoCell
            key={i}
            src={img}
            alt={`${title} — photo ${i + 1}`}
            onClick={() => openLightbox(i)}
            badge={
              i === 0 ? (
                <div className="absolute bottom-3 right-3 z-20 bg-black/50 backdrop-blur-md text-white px-2.5 py-1 rounded-full text-xs font-semibold">
                  1 / {images.length}
                </div>
              ) : undefined
            }
            overlay={
              i === 2 && extraCount > 0 ? (
                <div className="absolute inset-0 z-30 bg-black/55 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1 rounded-xl">
                  <span className="text-white font-bold text-2xl">+{extraCount}</span>
                  <span className="text-white/75 text-xs font-medium tracking-wide">photos</span>
                </div>
              ) : undefined
            }
          />
        ))}
      </div>

      {/* ── Lightbox ── */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col overflow-hidden"
          onClick={closeLightbox}
        >
          {/* Fullscreen blurred photo as background — no dead zones, no ugly borders */}
          <img
            key={`lb-bg-${currentIndex}`}
            src={images[currentIndex]}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-105 pointer-events-none select-none"
            style={{ filter: "blur(28px) brightness(0.35) saturate(1.4)" }}
          />
          {/* Subtle dark vignette */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/50" />

          {/* Header — counter + close only */}
          <div
            className="relative flex items-center justify-between px-5 py-4 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-white/70 text-sm font-semibold tabular-nums">
              {currentIndex + 1} / {images.length}
            </span>
            <button
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
              onClick={closeLightbox}
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Main image area */}
          <div
            className="relative flex-1 flex items-center justify-center px-14 min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute left-3 z-20 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
              onClick={goPrev}
            >
              <span className="material-symbols-outlined text-2xl">chevron_left</span>
            </button>

            {/*
              Wrapper sized to the image — logo is absolutely positioned
              inside this wrapper so it's always bottom-right of the photo itself
            */}
            <div
              className="relative flex items-center justify-center"
              style={{ maxHeight: "calc(100dvh - 180px)", maxWidth: "100%" }}
            >
              <img
                key={currentIndex}
                src={images[currentIndex]}
                alt={`${title} — photo ${currentIndex + 1}`}
                className="block max-w-full object-contain rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.6)]"
                style={{ maxHeight: "calc(100dvh - 180px)" }}
              />
              {/* Logo — bottom-right of the photo (inline-block trick via parent shrink) */}
              <div className="absolute bottom-4 right-4 pointer-events-none select-none">
                <img
                  src="/logo.png"
                  alt=""
                  className="h-7 w-auto brightness-0 invert opacity-65 drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]"
                />
              </div>
            </div>

            <button
              className="absolute right-3 z-20 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
              onClick={goNext}
            >
              <span className="material-symbols-outlined text-2xl">chevron_right</span>
            </button>
          </div>

          {/* Thumbnails strip */}
          <div
            className="relative shrink-0 py-3 px-4 overflow-x-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-2 justify-start md:justify-center">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`relative w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all duration-150 ${
                    i === currentIndex
                      ? "border-white opacity-100 scale-105"
                      : "border-transparent opacity-40 hover:opacity-70"
                  }`}
                >
                  <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover blur-sm scale-110 opacity-70" />
                  <img src={img} alt="" className="relative w-full h-full object-contain" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

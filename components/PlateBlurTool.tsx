"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  src: string;           // current image URL
  onDone: (url: string) => void;  // blurred image re-uploaded → new URL
  onSkip: () => void;
}

interface Rect { x: number; y: number; w: number; h: number }

export default function PlateBlurTool({ src, onDone, onSkip }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const imgRef     = useRef<HTMLImageElement | null>(null);
  const [rect, setRect]       = useState<Rect>({ x: 0.25, y: 0.72, w: 0.5, h: 0.1 });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ mx: 0, my: 0, rx: 0, ry: 0 });
  const [uploading, setUploading] = useState(false);
  const [loaded, setLoaded]   = useState(false);

  // Clamp rect inside [0,1]
  function clamp(r: Rect): Rect {
    const x = Math.max(0, Math.min(1 - r.w, r.x));
    const y = Math.max(0, Math.min(1 - r.h, r.y));
    const w = Math.max(0.05, Math.min(1 - x, r.w));
    const h = Math.max(0.02, Math.min(1 - y, r.h));
    return { x, y, w, h };
  }

  // Draw image + blue dashed rect on canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !loaded) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const rx = rect.x * canvas.width;
    const ry = rect.y * canvas.height;
    const rw = rect.w * canvas.width;
    const rh = rect.h * canvas.height;

    // Draw preview blur (overlay semi-transparent box)
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = "#2f6fb8";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.restore();

    // Resize handle (bottom-right)
    ctx.fillStyle = "#2f6fb8";
    ctx.beginPath();
    ctx.arc(rx + rw, ry + rh, 7, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px sans-serif";
    ctx.fillText("Plaque", rx + 4, ry + 14);
  }, [rect, loaded]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
      }
      setLoaded(true);
    };
    img.src = src;
  }, [src]);

  function getRelPos(e: React.MouseEvent | React.TouchEvent): { mx: number; my: number } {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    const scaleX = 1 / bounds.width;
    const scaleY = 1 / bounds.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { mx: (t.clientX - bounds.left) * scaleX, my: (t.clientY - bounds.top) * scaleY };
    }
    return { mx: (e.clientX - bounds.left) * scaleX, my: (e.clientY - bounds.top) * scaleY };
  }

  function onPointerDown(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const { mx, my } = getRelPos(e);
    // Check if near resize handle (bottom-right corner)
    const handleX = rect.x + rect.w;
    const handleY = rect.y + rect.h;
    const tol = 0.04;
    if (Math.abs(mx - handleX) < tol && Math.abs(my - handleY) < tol) {
      setResizing(true);
      setDragStart({ mx, my, rx: rect.w, ry: rect.h });
    } else {
      setDragging(true);
      setDragStart({ mx, my, rx: rect.x, ry: rect.y });
    }
  }

  function onPointerMove(e: React.MouseEvent | React.TouchEvent) {
    if (!dragging && !resizing) return;
    e.preventDefault();
    const { mx, my } = getRelPos(e);
    if (dragging) {
      setRect(clamp({
        ...rect,
        x: dragStart.rx + (mx - dragStart.mx),
        y: dragStart.ry + (my - dragStart.my),
      }));
    } else if (resizing) {
      setRect(clamp({
        ...rect,
        w: Math.max(0.05, dragStart.rx + (mx - dragStart.mx)),
        h: Math.max(0.02, dragStart.ry + (my - dragStart.my)),
      }));
    }
  }

  function onPointerUp() { setDragging(false); setResizing(false); }

  async function applyAndUpload() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    setUploading(true);

    // Render final image with actual blur (not just overlay)
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width  = img.naturalWidth;
    finalCanvas.height = img.naturalHeight;
    const ctx = finalCanvas.getContext("2d")!;

    // Draw full image
    ctx.drawImage(img, 0, 0);

    // Blur the plate region
    const px = rect.x * finalCanvas.width;
    const py = rect.y * finalCanvas.height;
    const pw = rect.w * finalCanvas.width;
    const ph = rect.h * finalCanvas.height;

    // Offscreen canvas for the blurred patch
    const blur = document.createElement("canvas");
    blur.width  = pw;
    blur.height = ph;
    const bCtx = blur.getContext("2d")!;
    // Scale down → scale up = pixelate/blur effect (works without filter support)
    bCtx.drawImage(img, px, py, pw, ph, 0, 0, pw / 8, ph / 8);
    bCtx.filter = "blur(4px)";
    bCtx.drawImage(blur, 0, 0, pw / 8, ph / 8, 0, 0, pw / 8, ph / 8);
    bCtx.filter = "none";

    // Scale back up (pixelated = censored look)
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(blur, 0, 0, pw / 8, ph / 8, px, py, pw, ph);
    ctx.restore();

    // Gaussian blur on top for soft look
    const softBlur = document.createElement("canvas");
    softBlur.width  = pw;
    softBlur.height = ph;
    const sbCtx = softBlur.getContext("2d")!;
    sbCtx.filter = "blur(12px)";
    sbCtx.drawImage(img, px, py, pw, ph, 0, 0, pw, ph);

    ctx.globalAlpha = 0.7;
    ctx.drawImage(softBlur, 0, 0, pw, ph, px, py, pw, ph);
    ctx.globalAlpha = 1;

    // Export and re-upload
    finalCanvas.toBlob(async (blob) => {
      if (!blob) { setUploading(false); return; }
      const file = new File([blob], "photo-floutee.jpg", { type: "image/jpeg" });
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (data.url) onDone(data.url);
      } catch {
        setUploading(false);
      }
    }, "image/jpeg", 0.92);
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onSkip(); }}>
      <div className="bg-white w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl flex flex-col max-h-[95dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="font-extrabold text-on-surface text-base font-['Manrope']">Flouter la plaque</h2>
            <p className="text-xs text-outline mt-0.5">Déplacez le cadre bleu sur la plaque d&apos;immatriculation</p>
          </div>
          <button onClick={onSkip} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-slate-500 text-[18px]">close</span>
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-slate-900 flex items-center justify-center p-3 min-h-0">
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-[60dvh] object-contain touch-none cursor-move rounded-lg"
            style={{ display: loaded ? "block" : "none" }}
            onMouseDown={onPointerDown}
            onMouseMove={onPointerMove}
            onMouseUp={onPointerUp}
            onMouseLeave={onPointerUp}
            onTouchStart={onPointerDown}
            onTouchMove={onPointerMove}
            onTouchEnd={onPointerUp}
          />
          {!loaded && (
            <div className="w-full h-48 flex items-center justify-center">
              <span className="material-symbols-outlined text-white/40 text-5xl animate-pulse">image</span>
            </div>
          )}
        </div>

        {/* Hint */}
        <div className="px-5 py-2 bg-amber-50 border-t border-amber-100 shrink-0">
          <p className="text-xs text-amber-700 font-medium flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>drag_pan</span>
            Glissez le cadre · Tirez le coin bleu pour redimensionner
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 shrink-0">
          <button onClick={onSkip}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors">
            Passer sans flouter
          </button>
          <button onClick={applyAndUpload} disabled={uploading || !loaded}
            className="flex-[2] py-3 rounded-xl bg-primary text-white text-sm font-black shadow-md shadow-primary/20 active:scale-95 transition-transform disabled:opacity-60">
            {uploading ? "Application…" : "Flouter et enregistrer"}
            {!uploading && <span className="material-symbols-outlined text-sm ml-1.5 align-[-3px]">blur_on</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

export function formatPrice(price: number | string | null | undefined): string {
  if (price === null || price === undefined) return "";
  const n = typeof price === "number" ? price : parseFloat(String(price));
  if (isNaN(n)) return "";
  if (n === 0) return "Gratuit";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 2592000) return `il y a ${Math.floor(diff / 86400)} j`;
  return d.toLocaleDateString("fr-FR");
}

import { API_BASE_URL } from "./config";

// Préfixe l'host API si l'URL est relative (dev local : /uploads/...).
export function absUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  return u.startsWith("http") ? u : `${API_BASE_URL}${u}`;
}

export function firstImage(images: string | string[] | null | undefined): string | null {
  if (!images) return null;
  let raw: string | null = null;
  if (Array.isArray(images)) raw = images[0] ?? null;
  else {
    try {
      const arr = JSON.parse(images);
      raw = Array.isArray(arr) ? arr[0] ?? null : null;
    } catch { raw = null; }
  }
  return absUrl(raw);
}

export function allImages(images: string | string[] | null | undefined): string[] {
  let arr: string[] = [];
  if (!images) return arr;
  if (Array.isArray(images)) arr = images;
  else {
    try {
      const parsed = JSON.parse(images);
      if (Array.isArray(parsed)) arr = parsed;
    } catch { /* noop */ }
  }
  return arr.map((u) => absUrl(u) ?? "").filter(Boolean);
}

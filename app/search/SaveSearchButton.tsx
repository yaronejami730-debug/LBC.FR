"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CATEGORIES } from "@/lib/categories";

function buildAlertName(params: URLSearchParams): string {
  const parts: string[] = [];
  const q = params.get("q");
  const category = params.get("category");
  const location = params.get("location");
  if (q) parts.push(`"${q}"`);
  if (category) parts.push(category);
  if (location) parts.push(`à ${location}`);
  return parts.length ? parts.join(" ") : "Toutes les annonces";
}

function buildFilters(params: URLSearchParams): Record<string, string> {
  const filters: Record<string, string> = {};
  params.forEach((value, key) => {
    if (key !== "_filters" && value) filters[key] = value;
  });
  // Normalize category to id
  if (filters.category) {
    const cat = CATEGORIES.find(
      (c) => c.label === filters.category || c.id === filters.category
    );
    if (cat) filters.category = cat.id;
  }
  return filters;
}

export default function SaveSearchButton() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function handleSave() {
    if (state === "done") {
      window.location.href = "/recherches";
      return;
    }
    setState("saving");
    try {
      const filters = buildFilters(searchParams);
      const name = buildAlertName(searchParams);
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, filters }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 401) {
          window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.href)}`;
          return;
        }
        throw new Error(err.error || "Erreur");
      }
      setState("done");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  return (
    <button
      onClick={handleSave}
      disabled={state === "saving"}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all active:scale-95 ${
        state === "done"
          ? "bg-green-50 border-green-200 text-green-700"
          : state === "error"
          ? "bg-red-50 border-red-200 text-red-600"
          : "bg-white border-outline-variant/20 text-on-surface-variant hover:border-primary/40 hover:text-primary"
      }`}
    >
      <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: state === "done" ? "'FILL' 1" : "'FILL' 0" }}>
        {state === "done" ? "notifications_active" : state === "error" ? "error" : "add_alert"}
      </span>
      {state === "saving"
        ? "Enregistrement…"
        : state === "done"
        ? "Alerte créée — gérer"
        : state === "error"
        ? "Erreur, réessayez"
        : "Créer une alerte"}
    </button>
  );
}

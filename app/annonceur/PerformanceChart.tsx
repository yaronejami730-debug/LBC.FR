"use client";

import { useState } from "react";
import { COLORS } from "@/lib/ads/theme";

type Point = { day: string; impressions: number; clicks: number; costCents: number };

const METRICS = [
  { key: "impressions", label: "Impressions", format: (v: number) => v.toLocaleString("fr-FR") },
  { key: "clicks", label: "Clics", format: (v: number) => v.toLocaleString("fr-FR") },
  {
    key: "costCents",
    label: "Dépenses",
    format: (v: number) => (v / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" }),
  },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

/**
 * Courbe de performance.
 *
 * Tracée en SVG plutôt qu'avec une bibliothèque : trois séries et trente
 * points ne justifient pas 80 ko de JavaScript sur un écran que l'annonceur
 * ouvre entre deux services.
 *
 * Une seule métrique à la fois. Superposer des impressions par milliers et des
 * euros par dizaines demande deux axes, et deux axes sur un même graphique
 * font mal lire les deux.
 */
export default function PerformanceChart({ series }: { series: Point[] }) {
  const [metric, setMetric] = useState<MetricKey>("impressions");
  const active = METRICS.find((m) => m.key === metric)!;

  const values = series.map((p) => p[metric]);
  const max = Math.max(...values, 1);
  const total = values.reduce((s, v) => s + v, 0);

  const W = 600;
  const H = 160;
  const step = series.length > 1 ? W / (series.length - 1) : W;
  const y = (v: number) => H - (v / max) * (H - 12) - 6;

  const line = series.map((p, i) => `${i * step},${y(p[metric])}`).join(" ");
  const area = `0,${H} ${line} ${W},${H}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-extrabold text-[15px]">Performance</h2>
          <p className="text-[12.5px]" style={{ color: COLORS.muted }}>
            {active.label} sur {series.length} jours · {active.format(total)} au total
          </p>
        </div>
        <div className="flex gap-1 p-0.5 rounded-xl" style={{ background: COLORS.tint }}>
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className="rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors"
              style={
                metric === m.key
                  ? { background: "#fff", color: COLORS.blue }
                  : { color: COLORS.muted }
              }
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {total === 0 ? (
        <p
          className="mt-4 rounded-xl px-4 py-6 text-center text-[13px] font-semibold"
          style={{ background: COLORS.tint, color: COLORS.muted }}
        >
          Aucune donnée sur la période. La courbe se remplira dès la première diffusion.
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-4 w-full h-[160px]"
          role="img"
          aria-label={`${active.label} par jour`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="adFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.blueLight} stopOpacity="0.28" />
              <stop offset="100%" stopColor={COLORS.blueLight} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Trois repères horizontaux : assez pour situer une valeur, pas
              assez pour encombrer. */}
          {[0.25, 0.5, 0.75].map((r) => (
            <line
              key={r}
              x1="0"
              x2={W}
              y1={H * r}
              y2={H * r}
              stroke={COLORS.line}
              strokeWidth="1"
            />
          ))}
          <polygon points={area} fill="url(#adFill)" />
          <polyline
            points={line}
            fill="none"
            stroke={COLORS.blue}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {/* Dernier point marqué : c'est celui qu'on cherche en ouvrant l'écran. */}
          <circle cx={(series.length - 1) * step} cy={y(values[values.length - 1] ?? 0)} r="3.5" fill={COLORS.blue} />
        </svg>
      )}

      <div className="mt-1 flex justify-between text-[11px]" style={{ color: COLORS.muted }}>
        <span>{formatDay(series[0]?.day)}</span>
        <span>{formatDay(series[series.length - 1]?.day)}</span>
      </div>
    </div>
  );
}

function formatDay(day?: string): string {
  if (!day) return "";
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

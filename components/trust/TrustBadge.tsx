import { type ReactNode } from "react";

interface TrustBadgeProps {
  icon: string;
  label: string;
  tone?: "neutral" | "primary" | "emerald";
  size?: "sm" | "md";
}

const TONE = {
  neutral:
    "bg-slate-50 text-slate-700 ring-1 ring-slate-200 dark:bg-white/5 dark:text-white/70 dark:ring-white/10",
  primary:
    "bg-[#2f6fb8]/10 text-[#2f6fb8] ring-1 ring-[#2f6fb8]/20 dark:bg-[#2f6fb8]/15 dark:text-[#2f6fb8]",
  emerald:
    "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20",
} as const;

export function TrustBadge({
  icon,
  label,
  tone = "neutral",
  size = "md",
}: TrustBadgeProps) {
  const padding =
    size === "sm" ? "px-2 py-1 text-[11px]" : "px-2.5 py-1 text-xs";
  const iconSize = size === "sm" ? "text-[13px]" : "text-[14px]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold tracking-tight ${padding} ${TONE[tone]}`}
    >
      <span className={`material-symbols-outlined ${iconSize}`} aria-hidden>
        {icon}
      </span>
      {label}
    </span>
  );
}

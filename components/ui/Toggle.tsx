"use client";

import { forwardRef, type ReactNode } from "react";

export type ToggleSize = "sm" | "md" | "lg";
export type ToggleTone = "primary" | "emerald" | "amber" | "error";

const SIZES: Record<
  ToggleSize,
  { track: string; knob: string; travel: string; inset: string; spinner: string }
> = {
  sm: {
    track: "w-9 h-5",
    knob: "w-4 h-4",
    travel: "translate-x-4",
    inset: "top-0.5 left-0.5",
    spinner: "w-2.5 h-2.5 border-[1.5px]",
  },
  md: {
    track: "w-11 h-6",
    knob: "w-5 h-5",
    travel: "translate-x-5",
    inset: "top-0.5 left-0.5",
    spinner: "w-3 h-3 border-[1.5px]",
  },
  lg: {
    track: "w-14 h-8",
    knob: "w-6 h-6",
    travel: "translate-x-6",
    inset: "top-1 left-1",
    spinner: "w-3.5 h-3.5 border-2",
  },
};

const KNOB_SHADOW = "shadow-[0_1px_2px_rgba(0,0,0,0.10),0_0_0_1px_rgba(0,0,0,0.04)]";

const TONES: Record<
  ToggleTone,
  { on: string; ring: string; spinner: string; iconBg: string; iconFg: string }
> = {
  primary: {
    on: "bg-primary",
    ring: "focus-visible:ring-primary/35",
    spinner: "border-primary",
    iconBg: "bg-primary/10",
    iconFg: "text-primary",
  },
  emerald: {
    on: "bg-emerald-500",
    ring: "focus-visible:ring-emerald-500/35",
    spinner: "border-emerald-500",
    iconBg: "bg-emerald-500/10",
    iconFg: "text-emerald-600",
  },
  amber: {
    on: "bg-amber-500",
    ring: "focus-visible:ring-amber-500/35",
    spinner: "border-amber-500",
    iconBg: "bg-amber-500/10",
    iconFg: "text-amber-600",
  },
  error: {
    on: "bg-error",
    ring: "focus-visible:ring-error/35",
    spinner: "border-error",
    iconBg: "bg-error/10",
    iconFg: "text-error",
  },
};

const EASE = "duration-[260ms] ease-[cubic-bezier(0.34,1.4,0.64,1)]";

type TrackProps = {
  checked: boolean;
  size?: ToggleSize;
  tone?: ToggleTone;
  loading?: boolean;
};

/**
 * Purely visual switch track. Renders a <span>, never focusable on its own —
 * always wrap it in a real <button role="switch"> (Toggle / ToggleField).
 */
export function ToggleTrack({ checked, size = "md", tone = "primary", loading = false }: TrackProps) {
  const s = SIZES[size];
  const t = TONES[tone];

  return (
    <span
      aria-hidden
      className={`
        relative inline-flex shrink-0 rounded-full transition-colors ${EASE} motion-reduce:transition-none
        ${s.track}
        ${
          checked
            ? t.on
            : "bg-[#e3e6ea] ring-1 ring-inset ring-black/[0.07] shadow-[inset_0_1px_2px_rgba(15,23,42,0.10)]"
        }
      `}
    >
      <span
        className={`
          absolute ${s.inset} ${s.knob} rounded-full bg-white ${KNOB_SHADOW}
          flex items-center justify-center
          transition-transform ${EASE} motion-reduce:transition-none
          ${checked ? `${s.travel} origin-right` : "translate-x-0 origin-left"}
          group-active/toggle:scale-x-[1.14]
        `}
      >
        {loading && (
          <span
            className={`block rounded-full animate-spin ${s.spinner} ${t.spinner} border-t-transparent`}
          />
        )}
      </span>
    </span>
  );
}

type ToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  size?: ToggleSize;
  tone?: ToggleTone;
  disabled?: boolean;
  loading?: boolean;
  /** Required when there is no visible label next to the switch. */
  label?: string;
  title?: string;
  /** Emits a hidden checkbox so the value is submitted with a plain <form>. */
  name?: string;
  className?: string;
  id?: string;
};

/** Standalone switch. Real button: keyboard, focus ring and screen readers work. */
export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  {
    checked,
    onChange,
    size = "md",
    tone = "primary",
    disabled = false,
    loading = false,
    label,
    title,
    name,
    className = "",
    id,
  },
  ref,
) {
  const t = TONES[tone];
  const locked = disabled || loading;

  return (
    <>
      <button
        ref={ref}
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-busy={loading || undefined}
        title={title}
        disabled={locked}
        onClick={() => onChange(!checked)}
        className={`
          group/toggle inline-flex shrink-0 rounded-full outline-none
          focus-visible:ring-[3px] focus-visible:ring-offset-2 ${t.ring}
          disabled:opacity-45 disabled:cursor-not-allowed
          ${locked ? "" : "cursor-pointer"}
          ${className}
        `}
      >
        <ToggleTrack checked={checked} size={size} tone={tone} loading={loading} />
      </button>
      {name && <input type="hidden" name={name} value={checked ? "on" : ""} />}
    </>
  );
});

type ToggleFieldProps = Omit<ToggleProps, "label" | "className"> & {
  label: ReactNode;
  description?: ReactNode;
  /** Material Symbols glyph name, e.g. "mail". */
  icon?: string;
  /** Extra content rendered under the description (badges, links…). */
  children?: ReactNode;
  className?: string;
};

/**
 * Full clickable row: icon + label + description + switch.
 * The whole row is one <button role="switch">, so tapping anywhere toggles
 * and the row is reachable with Tab / Space / Enter.
 */
export function ToggleField({
  checked,
  onChange,
  label,
  description,
  icon,
  children,
  size = "md",
  tone = "primary",
  disabled = false,
  loading = false,
  title,
  name,
  className = "",
  id,
}: ToggleFieldProps) {
  const t = TONES[tone];
  const locked = disabled || loading;

  return (
    <>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-busy={loading || undefined}
        title={title}
        disabled={locked}
        onClick={() => onChange(!checked)}
        className={`
          group/toggle w-full flex items-center gap-3 text-left rounded-2xl outline-none
          focus-visible:ring-[3px] focus-visible:ring-offset-2 ${t.ring}
          disabled:opacity-45 disabled:cursor-not-allowed
          ${locked ? "" : "cursor-pointer"}
          ${className}
        `}
      >
        {icon && (
          <span
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${EASE} ${
              checked ? t.iconBg : "bg-surface-container-low"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[18px] transition-colors ${EASE} ${
                checked ? t.iconFg : "text-outline"
              }`}
              style={checked ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {icon}
            </span>
          </span>
        )}

        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-on-surface">{label}</span>
          {description && (
            <span className="block text-xs text-outline mt-0.5 leading-relaxed">{description}</span>
          )}
          {children}
        </span>

        <ToggleTrack checked={checked} size={size} tone={tone} loading={loading} />
      </button>
      {name && <input type="hidden" name={name} value={checked ? "on" : ""} />}
    </>
  );
}

type InlineToggleProps = Omit<ToggleProps, "label"> & { label: ReactNode };

/**
 * Compact inline switch with its label to the right — for dense forms where a
 * full ToggleField row would be too heavy. Still one <button role="switch">,
 * so the label text is part of the click target.
 */
export function InlineToggle({
  checked,
  onChange,
  label,
  size = "sm",
  tone = "primary",
  disabled = false,
  loading = false,
  title,
  name,
  className = "",
  id,
}: InlineToggleProps) {
  const t = TONES[tone];
  const locked = disabled || loading;

  return (
    <>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-busy={loading || undefined}
        title={title}
        disabled={locked}
        onClick={() => onChange(!checked)}
        className={`
          group/toggle inline-flex items-center gap-2.5 select-none rounded-full outline-none
          focus-visible:ring-[3px] focus-visible:ring-offset-2 ${t.ring}
          disabled:opacity-45 disabled:cursor-not-allowed
          ${locked ? "" : "cursor-pointer"}
          ${className}
        `}
      >
        <ToggleTrack checked={checked} size={size} tone={tone} loading={loading} />
        <span
          className={`text-sm font-medium transition-colors ${EASE} ${
            checked ? "text-on-surface" : "text-on-surface-variant"
          }`}
        >
          {label}
        </span>
      </button>
      {name && <input type="hidden" name={name} value={checked ? "on" : ""} />}
    </>
  );
}

export default Toggle;

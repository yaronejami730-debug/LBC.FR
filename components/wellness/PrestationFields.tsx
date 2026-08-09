"use client";

import { visibleFields, type WellnessField } from "@/lib/wellness/form-schema";

/**
 * Rend le formulaire spécialisé d'une sous-catégorie bien-être.
 *
 * Piloté par lib/wellness/form-schema : les champs apparaissent et
 * disparaissent selon les réponses déjà données. Partagé par l'annonce d'un
 * particulier et l'ajout d'une ligne à la carte d'un professionnel — le même
 * écran, donc jamais deux vérités.
 */
export default function PrestationFields({
  subcategory,
  values,
  onChange,
  compact = false,
}: {
  subcategory: string;
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  /** Version resserrée pour la fiche pro. */
  compact?: boolean;
}) {
  const fields = visibleFields(subcategory, values);
  if (fields.length === 0) return null;

  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      {fields.map((f) => (
        <Field key={f.id} field={f} value={values[f.id] ?? ""} onChange={onChange} />
      ))}
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: WellnessField;
  value: string;
  onChange: (id: string, value: string) => void;
}) {
  const label = (
    <label className="text-[10px] text-outline uppercase font-bold tracking-wider block mb-1.5">
      {field.label}
      {field.required && <span className="text-primary"> *</span>}
    </label>
  );

  if (field.kind === "pills") {
    return (
      <div>
        {label}
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map((o) => {
            const active = value === o;
            // Une durée est stockée en minutes, affichée en clair.
            const shown = field.id === "durationMin" ? minutesLabel(o) : o;
            return (
              <button
                key={o}
                type="button"
                onClick={() => onChange(field.id, active ? "" : o)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
                  active
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary"
                }`}
              >
                {shown}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.kind === "select") {
    return (
      <div>
        {label}
        <select
          value={value}
          onChange={(e) => onChange(field.id, e.target.value)}
          className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-base text-on-surface outline-none focus:ring-2 focus:ring-primary/50 border border-transparent focus:border-primary/30"
        >
          <option value="">Non précisé</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div>
      {label}
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(field.id, e.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          className="w-full bg-surface-container-low rounded-xl px-4 py-3 pr-20 text-base text-on-surface outline-none focus:ring-2 focus:ring-primary/50 border border-transparent focus:border-primary/30"
        />
        {field.suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-outline">
            {field.suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function minutesLabel(min: string): string {
  const n = parseInt(min);
  if (!n) return min;
  if (n < 60) return `${n} min`;
  return n % 60 === 0 ? `${n / 60} h` : `${Math.floor(n / 60)} h ${n % 60}`;
}

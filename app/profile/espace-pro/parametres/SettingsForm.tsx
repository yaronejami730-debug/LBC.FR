"use client";

import { useState } from "react";
import { ToggleField } from "@/components/ui/Toggle";

export type BookingSettings = {
  slotGranularityMin: number;
  bufferMin: number;
  minNoticeMin: number;
  maxAdvanceDays: number;
  cancelDeadlineMin: number;
  autoConfirm: boolean;
  allowCancel: boolean;
  allowReschedule: boolean;
};

const card = "bg-white rounded-2xl border border-slate-100 p-5";
const input =
  "w-full bg-surface-container-low rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50 border border-transparent focus:border-primary/30";

/** Règles de réservation. Le serveur reborne tout : ce formulaire n'est qu'une aide à la saisie. */
export default function SettingsForm({ initial }: { initial: BookingSettings }) {
  const [settings, setSettings] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const num = (key: keyof BookingSettings) => (value: string) =>
    setSettings((prev) => ({ ...prev, [key]: Number(value) }));
  const bool = (key: keyof BookingSettings) => (value: boolean) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/pro/booking-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setMessage({ ok: false, text: data.error ?? "Enregistrement impossible" });
    setSettings({ ...settings, ...data.settings });
    setMessage({ ok: true, text: "Règles enregistrées" });
  }

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            message.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"
          }`}
        >
          {message.text}
        </div>
      )}

      <section className={card}>
        <h2 className="text-base font-extrabold font-['Manrope'] mb-4">Créneaux</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label="Pas des créneaux"
            hint="15 min → 14h00, 14h15, 14h30…"
            suffix="min"
            value={settings.slotGranularityMin}
            onChange={num("slotGranularityMin")}
            min={5}
            max={120}
          />
          <Field
            label="Battement entre deux rendez-vous"
            hint="Temps de remise en état du poste"
            suffix="min"
            value={settings.bufferMin}
            onChange={num("bufferMin")}
            min={0}
            max={120}
          />
          <Field
            label="Délai minimum avant réservation"
            hint="On ne réserve pas pour dans cinq minutes"
            suffix="min"
            value={settings.minNoticeMin}
            onChange={num("minNoticeMin")}
            min={0}
            max={43200}
          />
          <Field
            label="Réservable jusqu'à"
            hint="Horizon du calendrier"
            suffix="jours"
            value={settings.maxAdvanceDays}
            onChange={num("maxAdvanceDays")}
            min={1}
            max={365}
          />
        </div>
      </section>

      <section className={card}>
        <h2 className="text-base font-extrabold font-['Manrope'] mb-4">Validation et annulation</h2>
        <div className="space-y-3">
          <Toggle
            label="Confirmation automatique"
            hint="Sinon chaque demande reste « à confirmer » jusqu'à votre validation"
            checked={settings.autoConfirm}
            onChange={bool("autoConfirm")}
          />
          <Toggle
            label="Le client peut annuler en ligne"
            checked={settings.allowCancel}
            onChange={bool("allowCancel")}
          />
          <Toggle
            label="Le client peut déplacer son rendez-vous"
            checked={settings.allowReschedule}
            onChange={bool("allowReschedule")}
          />
          <Field
            label="Annulation possible jusqu'à"
            hint="1440 min = 24 h avant le rendez-vous"
            suffix="min avant"
            value={settings.cancelDeadlineMin}
            onChange={num("cancelDeadlineMin")}
            min={0}
            max={43200}
          />
        </div>
      </section>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {saving ? "Enregistrement…" : "Enregistrer"}
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  suffix,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  hint?: string;
  suffix: string;
  value: number;
  onChange: (value: string) => void;
  min: number;
  max: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold block">{label}</span>
      {hint && <span className="text-xs text-outline block mb-1.5">{hint}</span>}
      <span className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value)}
          className={input}
        />
        <span className="text-xs text-outline shrink-0">{suffix}</span>
      </span>
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return <ToggleField checked={checked} onChange={onChange} label={label} description={hint} />;
}

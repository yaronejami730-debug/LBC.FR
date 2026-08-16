"use client";

/**
 * Réglages de la collecte.
 *
 * Chaque champ affiche ses bornes sous l'intitulé. Ce n'est pas une décoration :
 * ce formulaire décide combien d'emails partent, et à quelle fréquence. Voir
 * « minimum 30 jours » à côté du silence évite de découvrir la limite en la
 * heurtant — et rappelle qu'elle existe pour une raison.
 *
 * Les valeurs hors bornes sont ramenées par le serveur, jamais rejetées avec un
 * message d'échec : corriger vaut mieux que renvoyer quelqu'un à son formulaire.
 */

import { useState, useTransition } from "react";
import { updateSatisfactionSettings } from "./actions";
import { BOUNDS, type SatisfactionSettings } from "@/lib/satisfaction/config";

export default function SettingsForm({ initial }: { initial: SatisfactionSettings }) {
  const [values, setValues] = useState<SatisfactionSettings>(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function set<K extends keyof SatisfactionSettings>(key: K, value: SatisfactionSettings[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setMessage(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await updateSatisfactionSettings(values);
      if (res.ok) {
        setValues(res.settings);
        setMessage({ ok: true, text: "Réglages enregistrés." });
      } else {
        setMessage({ ok: false, text: res.error });
      }
    });
  }

  return (
    <form onSubmit={submit} className="bg-white border border-[#eceef0] rounded-xl p-5 space-y-5">
      <div>
        <h2 className="font-bold text-[#191c1e]">Réglages</h2>
        <p className="text-sm text-[#777683] mt-1">
          Appliqués au prochain passage. Vider la table de réglages rétablit les valeurs
          d&apos;origine du code.
        </p>
      </div>

      <div className="space-y-2.5">
        <Toggle
          label="Collecte activée"
          hint="Coupe tout : périodique et activité."
          checked={values.enabled}
          onChange={(v) => set("enabled", v)}
        />
        <Toggle
          label="Campagne périodique"
          hint="Sollicitation espacée, sans lien avec l'activité."
          checked={values.periodicEnabled}
          onChange={(v) => set("periodicEnabled", v)}
          disabled={!values.enabled}
        />
        <Toggle
          label="Campagne après activité"
          hint="Déclenchée par une série de publications."
          checked={values.activityEnabled}
          onChange={(v) => set("activityEnabled", v)}
          disabled={!values.enabled}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-1">
        <Num
          label="Silence après un envoi"
          unit="jours"
          field="cooldownDays"
          value={values.cooldownDays}
          onChange={(v) => set("cooldownDays", v)}
          hint="La protection principale, partagée par les deux campagnes."
        />
        <Num
          label="Seuil d'annonces"
          unit="annonces"
          field="activityThreshold"
          value={values.activityThreshold}
          onChange={(v) => set("activityThreshold", v)}
          hint="Publications avant qu'on juge la question pertinente."
        />
        <Num
          label="Fenêtre de regroupement"
          unit="heures"
          field="burstWindowHours"
          value={values.burstWindowHours}
          onChange={(v) => set("burstWindowHours", v)}
          hint="Délai avant envoi. Toute activité s'y fond."
        />
        <Num
          label="Délai périodique minimum"
          unit="jours"
          field="periodicMinDays"
          value={values.periodicMinDays}
          onChange={(v) => set("periodicMinDays", v)}
        />
        <Num
          label="Délai périodique maximum"
          unit="jours"
          field="periodicMaxDays"
          value={values.periodicMaxDays}
          onChange={(v) => set("periodicMaxDays", v)}
          hint="Chaque compte tire une date dans cet intervalle."
        />
        <Num
          label="Envois par passage"
          unit="emails"
          field="maxSendsPerRun"
          value={values.maxSendsPerRun}
          onChange={(v) => set("maxSendsPerRun", v)}
          hint="Étale la campagne sur plusieurs jours."
        />
      </div>

      {message && (
        <p
          role="status"
          className={`text-sm rounded-lg px-4 py-2.5 ${
            message.ok
              ? "bg-[#e2efea] text-[#1d6a58]"
              : "bg-[#fdf2f3] text-[#99303a]"
          }`}
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-[#2f6fb8] px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? "opacity-45" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-[#2f6fb8]"
      />
      <span>
        <span className="block text-sm font-semibold text-[#191c1e]">{label}</span>
        <span className="block text-xs text-[#777683]">{hint}</span>
      </span>
    </label>
  );
}

function Num({
  label,
  unit,
  field,
  value,
  onChange,
  hint,
}: {
  label: string;
  unit: string;
  field: keyof typeof BOUNDS;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  const { min, max } = BOUNDS[field];
  return (
    <label className="block">
      <span className="block text-xs font-bold text-[#5a5b6e] uppercase tracking-wider mb-1.5">
        {label}
      </span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24 rounded-lg border border-[#dfe4e8] px-3 py-2 text-sm tabular-nums focus:border-[#2f6fb8] focus:ring-2 focus:ring-[#2f6fb8]/20 outline-none"
        />
        <span className="text-xs text-[#777683]">{unit}</span>
      </span>
      <span className="block text-[11px] text-[#9ea4a9] mt-1">
        entre {min} et {max}
        {hint ? ` · ${hint}` : ""}
      </span>
    </label>
  );
}

"use client";

import { useState } from "react";
import WeekHoursEditor, {
  textFromWeek,
  weekFromText,
  type WeekHours,
} from "@/components/pro/WeekHoursEditor";

/**
 * Horaires d'ouverture de la boutique — ce que le public lit sur la fiche.
 *
 * Volontairement séparé des plannings de l'équipe : la boutique peut être
 * ouverte le lundi sans que personne n'y soit réservable, et une esthéticienne
 * peut travailler un jour de fermeture pour rattraper un rendez-vous. Mélanger
 * les deux obligerait à mentir sur l'un pour être exact sur l'autre.
 *
 * La saisie, elle, est commune : `WeekHoursEditor` sert aussi aux horaires des
 * membres. Deux plages par jour suffisent ici — au-delà, ce n'est plus un
 * horaire d'ouverture mais un planning, et un planning appartient à un membre.
 */
export default function OpeningHoursForm({
  initial,
  establishmentId,
}: {
  /** Texte enregistré par jour, ex. { lundi: "09:00 - 19:00" }. */
  initial: Record<string, string>;
  establishmentId: string;
}) {
  const [week, setWeek] = useState<WeekHours>(() => weekFromText(initial));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/pro-profile/hours", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours: textFromWeek(week), establishmentId }),
      });
      const data = await res.json().catch(() => ({}));
      setMessage(
        res.ok
          ? { ok: true, text: "Horaires enregistrés — la fiche publique est à jour." }
          : { ok: false, text: data.error ?? "Enregistrement impossible" },
      );
    } catch {
      setMessage({ ok: false, text: "Erreur réseau, réessayez." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            message.ok
              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
              : "bg-rose-50 text-rose-700 border border-rose-100"
          }`}
        >
          {message.text}
        </div>
      )}

      <section className="bg-white rounded-2xl border border-slate-100 p-5">
        <WeekHoursEditor value={week} onChange={setWeek} maxRangesPerDay={2} />

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-5 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : "Enregistrer les horaires"}
        </button>
      </section>
    </div>
  );
}

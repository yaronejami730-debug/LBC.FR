"use client";

import { useCallback, useEffect, useState } from "react";

export type ManagedService = { id: string; label: string; section: string; durationMin: number | null };

export type ManagedMember = {
  id: string;
  displayName: string;
  role: string | null;
  color: string;
  isActive: boolean;
  serviceIds: string[];
  /** Identifiant d'accès au planning, `null` tant qu'aucun n'a été généré. */
  loginId?: string | null;
  hasAccess?: boolean;
};

type Schedule = { weekday: number; startMin: number; endMin: number; label?: string | null };
type TimeOff = { id: string; memberId: string; startAt: string; endAt: string; reason: string | null };

const WEEKDAYS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 0, label: "Dimanche" },
];

const card = "bg-white rounded-2xl border border-slate-100 p-5";
const input =
  "w-full bg-surface-container-low rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 border border-transparent focus:border-primary/30";

const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const toMin = (value: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * Gestion de l'équipe : qui travaille, sur quelles prestations, à quelles
 * heures, avec quelles pauses et quelles absences.
 *
 * Tout passe par `/api/pro/*` — aucune règle n'est décidée ici. Le composant
 * ne fait que présenter et poster : c'est le serveur qui borne les valeurs et
 * qui refuse une plage incohérente.
 */
export default function TeamManager({
  initialMembers,
  services,
}: {
  initialMembers: ManagedMember[];
  services: ManagedService[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [selectedId, setSelectedId] = useState<string | null>(initialMembers[0]?.id ?? null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [hours, setHours] = useState<Schedule[]>([]);
  const [breaks, setBreaks] = useState<Schedule[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);

  const selected = members.find((m) => m.id === selectedId) ?? null;

  const notify = (ok: boolean, text: string) => {
    setMessage({ ok, text });
    window.setTimeout(() => setMessage(null), 4000);
  };

  /* --- Planning du membre sélectionné ---------------------------------- */
  const loadSchedule = useCallback(async (memberId: string) => {
    const res = await fetch(`/api/pro/members/${memberId}/hours`);
    if (!res.ok) return;
    const data = await res.json();
    setHours(data.workingHours ?? []);
    setBreaks(data.breaks ?? []);
  }, []);

  useEffect(() => {
    if (selectedId) void loadSchedule(selectedId);
  }, [selectedId, loadSchedule]);

  const loadTimeOff = useCallback(async () => {
    const res = await fetch("/api/pro/timeoff");
    if (res.ok) setTimeOff((await res.json()).timeOff ?? []);
  }, []);

  useEffect(() => {
    void loadTimeOff();
  }, [loadTimeOff]);

  /* --- Actions ---------------------------------------------------------- */
  async function addMember() {
    const displayName = window.prompt("Nom du membre (ex. Corinne)")?.trim();
    if (!displayName) return;
    setBusy(true);
    const res = await fetch("/api/pro/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return notify(false, data.error ?? "Ajout impossible");
    setMembers((prev) => [...prev, { ...data.member, serviceIds: [] }]);
    setSelectedId(data.member.id);
    notify(true, `${displayName} ajouté·e. Renseignez ses horaires pour ouvrir ses créneaux.`);
  }

  async function patchMember(id: string, patch: Partial<ManagedMember>) {
    setBusy(true);
    const res = await fetch(`/api/pro/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return notify(false, data.error ?? "Modification impossible");
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    notify(true, "Enregistré");
  }

  /**
   * Identifiants fraîchement générés, affichés une seule fois.
   *
   * Ils ne sont pas conservés en base en clair : ce que la responsable ne note
   * pas maintenant est perdu, et il faudra régénérer. C'est le compromis
   * habituel, et le dire à l'écran vaut mieux que de le découvrir après.
   */
  const [freshCredentials, setFreshCredentials] = useState<{
    memberId: string;
    displayName: string;
    loginId: string;
    password: string;
  } | null>(null);

  async function generateAccess(m: ManagedMember) {
    const res = await fetch(`/api/pro/members/${m.id}/credentials`, { method: "POST" });
    const data = (await res.json()) as { loginId?: string; password?: string; error?: string };
    if (!res.ok || !data.loginId || !data.password) {
      notify(false, data.error ?? "Génération impossible.");
      return;
    }
    setFreshCredentials({
      memberId: m.id,
      displayName: m.displayName,
      loginId: data.loginId,
      password: data.password,
    });
    notify(true, `Accès créé pour ${m.displayName}. Notez le mot de passe, il ne sera plus affiché.`);
  }

  async function revokeAccess(m: ManagedMember) {
    if (!window.confirm(`Couper l'accès au planning de ${m.displayName} ?`)) return;
    const res = await fetch(`/api/pro/members/${m.id}/credentials`, { method: "DELETE" });
    if (!res.ok) {
      notify(false, "Retrait impossible.");
      return;
    }
    if (freshCredentials?.memberId === m.id) setFreshCredentials(null);
    notify(true, `Accès de ${m.displayName} retiré. Ses rendez-vous sont conservés.`);
  }

  async function removeMember(id: string) {
    if (!window.confirm("Retirer ce membre de l'équipe ?")) return;
    setBusy(true);
    const res = await fetch(`/api/pro/members/${id}`, { method: "DELETE" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return notify(false, data.error ?? "Suppression impossible");
    if (data.deactivated) {
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, isActive: false } : m)));
      notify(true, "Membre désactivé — ses rendez-vous passés sont conservés.");
    } else {
      setMembers((prev) => prev.filter((m) => m.id !== id));
      setSelectedId((prev) => (prev === id ? null : prev));
      notify(true, "Membre retiré");
    }
  }

  async function toggleService(memberId: string, serviceId: string) {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;
    const next = member.serviceIds.includes(serviceId)
      ? member.serviceIds.filter((id) => id !== serviceId)
      : [...member.serviceIds, serviceId];

    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, serviceIds: next } : m)));

    const res = await fetch(`/api/pro/members/${memberId}/services`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceIds: next }),
    });
    if (!res.ok) {
      // Retour à l'état précédent : afficher une case cochée qui ne l'est pas
      // en base ferait proposer un praticien qui ne sait pas faire.
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, serviceIds: member.serviceIds } : m)));
      notify(false, "Modification refusée");
    }
  }

  async function saveSchedule() {
    if (!selectedId) return;
    setBusy(true);
    const res = await fetch(`/api/pro/members/${selectedId}/hours`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workingHours: hours, breaks }),
    });
    const data = await res.json();
    setBusy(false);
    notify(res.ok, res.ok ? "Horaires enregistrés" : (data.error ?? "Enregistrement impossible"));
  }

  async function addTimeOff(form: HTMLFormElement) {
    if (!selectedId) return;
    const fd = new FormData(form);
    const startAt = String(fd.get("startAt") ?? "");
    const endAt = String(fd.get("endAt") ?? "");
    if (!startAt || !endAt) return;

    setBusy(true);
    const res = await fetch("/api/pro/timeoff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId: selectedId,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        reason: String(fd.get("reason") ?? ""),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return notify(false, data.error ?? "Ajout impossible");
    form.reset();
    void loadTimeOff();
    notify(
      true,
      data.conflictingBookings > 0
        ? `Absence enregistrée — ${data.conflictingBookings} rendez-vous déjà pris sur cette période, à traiter dans l'agenda.`
        : "Absence enregistrée",
    );
  }

  async function removeTimeOff(id: string) {
    setBusy(true);
    await fetch(`/api/pro/timeoff?id=${id}`, { method: "DELETE" });
    setBusy(false);
    void loadTimeOff();
  }

  /* --- Édition locale du planning --------------------------------------- */
  const setRow = (list: Schedule[], setList: (v: Schedule[]) => void, index: number, patch: Partial<Schedule>) =>
    setList(list.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <div className="space-y-5">
      {message && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            message.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Équipe */}
      <section className={card}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-extrabold font-['Manrope']">L&apos;équipe</h2>
          <button
            type="button"
            onClick={addMember}
            disabled={busy}
            className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            + Ajouter
          </button>
        </div>

        {members.length === 0 ? (
          <p className="text-sm text-outline">
            Aucun membre. Ajoutez au moins une personne : sans équipe, aucun créneau ne peut être proposé.
          </p>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => (
              <li
                key={m.id}
                className={`rounded-xl border px-3 py-2.5 flex items-center gap-3 ${
                  selectedId === m.id ? "border-primary bg-primary/5" : "border-slate-100"
                } ${m.isActive ? "" : "opacity-50"}`}
              >
                <button type="button" onClick={() => setSelectedId(m.id)} className="flex items-center gap-3 flex-1 text-left">
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-extrabold shrink-0"
                    style={{ backgroundColor: m.color }}
                  >
                    {m.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="font-bold text-sm block truncate">{m.displayName}</span>
                    <span className="text-xs text-outline">
                      {m.role ?? "—"} · {m.serviceIds.length} prestation{m.serviceIds.length > 1 ? "s" : ""}
                      {m.isActive ? "" : " · désactivé"}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => patchMember(m.id, { isActive: !m.isActive })}
                  title={m.isActive ? "Désactiver" : "Réactiver"}
                  className="text-xs font-bold text-outline hover:text-primary px-2"
                >
                  {m.isActive ? "Désactiver" : "Réactiver"}
                </button>
                {/* Accès au planning : la responsable distribue, elle ne
                    demande à personne de s'inscrire. */}
                <button
                  type="button"
                  onClick={() => (m.loginId ? revokeAccess(m) : generateAccess(m))}
                  title={m.loginId ? "Couper l'accès au planning" : "Créer un accès au planning"}
                  className="text-xs font-bold text-outline hover:text-primary px-2 whitespace-nowrap"
                >
                  {m.loginId ? "Couper l'accès" : "Créer un accès"}
                </button>
                <button
                  type="button"
                  onClick={() => removeMember(m.id)}
                  title="Retirer"
                  className="text-outline hover:text-rose-600"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {freshCredentials && (
          <div className="mt-4 rounded-xl border-2 border-primary/30 bg-[#f5f9ff] p-4">
            <p className="text-sm font-extrabold text-primary">
              Accès de {freshCredentials.displayName}
            </p>
            <p className="text-[11px] text-outline mt-1 leading-relaxed">
              Transmettez-les à la personne concernée. Le mot de passe n&apos;est affiché
              qu&apos;une fois : s&apos;il est perdu, il faudra en générer un nouveau.
            </p>
            <dl className="mt-3 space-y-2">
              <div className="flex items-baseline gap-3">
                <dt className="text-[10px] uppercase font-bold tracking-wider text-outline w-24 shrink-0">
                  Identifiant
                </dt>
                <dd className="font-mono font-bold select-all">{freshCredentials.loginId}</dd>
              </div>
              <div className="flex items-baseline gap-3">
                <dt className="text-[10px] uppercase font-bold tracking-wider text-outline w-24 shrink-0">
                  Mot de passe
                </dt>
                <dd className="font-mono font-bold select-all">{freshCredentials.password}</dd>
              </div>
              <div className="flex items-baseline gap-3">
                <dt className="text-[10px] uppercase font-bold tracking-wider text-outline w-24 shrink-0">
                  Connexion
                </dt>
                <dd className="font-semibold text-primary">/equipe/connexion</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => setFreshCredentials(null)}
              className="mt-3 text-xs font-bold text-outline underline"
            >
              J&apos;ai noté, masquer
            </button>
          </div>
        )}
      </section>

      {selected && (
        <>
          {/* Prestations du membre */}
          <section className={card}>
            <h2 className="text-base font-extrabold font-['Manrope'] mb-1">
              Prestations de {selected.displayName}
            </h2>
            <p className="text-xs text-outline mb-3">
              Cochez ce que cette personne sait faire. Elle ne sera proposée que pour ces prestations.
            </p>
            {services.length === 0 ? (
              <p className="text-sm text-outline">Ajoutez d&apos;abord des prestations dans « Ma fiche ».</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-1.5">
                {services.map((s) => (
                  <label key={s.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2 hover:bg-surface-container-low cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.serviceIds.includes(s.id)}
                      onChange={() => toggleService(selected.id, s.id)}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-sm">
                      {s.label}
                      <span className="text-xs text-outline ml-1">
                        {s.durationMin ? `· ${s.durationMin} min` : "· sans durée, non réservable"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          {/* Horaires + pauses */}
          <section className={card}>
            <h2 className="text-base font-extrabold font-['Manrope'] mb-1">
              Horaires de {selected.displayName}
            </h2>
            <p className="text-xs text-outline mb-3">
              Une ligne par plage. Deux plages le même jour pour une coupure longue ; sinon utilisez les pauses.
            </p>

            <ScheduleTable
              rows={hours}
              onChange={(i, patch) => setRow(hours, setHours, i, patch)}
              onRemove={(i) => setHours(hours.filter((_, x) => x !== i))}
              onAdd={() => setHours([...hours, { weekday: 2, startMin: 600, endMin: 1140 }])}
              addLabel="+ Ajouter une plage"
            />

            <h3 className="text-sm font-bold mt-5 mb-2">Pauses</h3>
            <ScheduleTable
              rows={breaks}
              onChange={(i, patch) => setRow(breaks, setBreaks, i, patch)}
              onRemove={(i) => setBreaks(breaks.filter((_, x) => x !== i))}
              onAdd={() => setBreaks([...breaks, { weekday: 2, startMin: 750, endMin: 810, label: "Déjeuner" }])}
              addLabel="+ Ajouter une pause"
              withLabel
            />

            <button
              type="button"
              onClick={saveSchedule}
              disabled={busy}
              className="mt-4 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? "Enregistrement…" : "Enregistrer les horaires"}
            </button>
          </section>

          {/* Absences */}
          <section className={card}>
            <h2 className="text-base font-extrabold font-['Manrope'] mb-1">Absences</h2>
            <p className="text-xs text-outline mb-3">
              Congés, formation, rendez-vous personnel. Les créneaux concernés disparaissent immédiatement.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void addTimeOff(e.currentTarget);
              }}
              className="grid sm:grid-cols-4 gap-2 items-end"
            >
              <label className="text-xs font-semibold text-outline">
                Début
                <input type="datetime-local" name="startAt" required className={input} />
              </label>
              <label className="text-xs font-semibold text-outline">
                Fin
                <input type="datetime-local" name="endAt" required className={input} />
              </label>
              <label className="text-xs font-semibold text-outline">
                Motif
                <input type="text" name="reason" placeholder="Congés" className={input} />
              </label>
              <button type="submit" disabled={busy} className="rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                Ajouter
              </button>
            </form>

            <ul className="mt-4 divide-y divide-slate-100">
              {timeOff
                .filter((t) => t.memberId === selected.id)
                .map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span>
                      {new Date(t.startAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })} →{" "}
                      {new Date(t.endAt).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                      {t.reason && <span className="text-outline"> · {t.reason}</span>}
                    </span>
                    <button type="button" onClick={() => removeTimeOff(t.id)} className="text-outline hover:text-rose-600">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </li>
                ))}
              {timeOff.filter((t) => t.memberId === selected.id).length === 0 && (
                <li className="py-2.5 text-sm text-outline">Aucune absence à venir.</li>
              )}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function ScheduleTable({
  rows,
  onChange,
  onRemove,
  onAdd,
  addLabel,
  withLabel = false,
}: {
  rows: Schedule[];
  onChange: (index: number, patch: Partial<Schedule>) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  addLabel: string;
  withLabel?: boolean;
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <select
            value={row.weekday}
            onChange={(e) => onChange(i, { weekday: Number(e.target.value) })}
            className={`${input} w-32`}
          >
            {WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={toHHMM(row.startMin)}
            onChange={(e) => {
              const v = toMin(e.target.value);
              if (v !== null) onChange(i, { startMin: v });
            }}
            className={`${input} w-28`}
          />
          <span className="text-outline text-sm">→</span>
          <input
            type="time"
            value={toHHMM(row.endMin)}
            onChange={(e) => {
              const v = toMin(e.target.value);
              if (v !== null) onChange(i, { endMin: v });
            }}
            className={`${input} w-28`}
          />
          {withLabel && (
            <input
              type="text"
              value={row.label ?? ""}
              placeholder="Motif"
              onChange={(e) => onChange(i, { label: e.target.value })}
              className={`${input} w-32`}
            />
          )}
          <button type="button" onClick={() => onRemove(i)} className="text-outline hover:text-rose-600">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      ))}
      <button type="button" onClick={onAdd} className="text-sm font-bold text-primary">
        {addLabel}
      </button>
    </div>
  );
}

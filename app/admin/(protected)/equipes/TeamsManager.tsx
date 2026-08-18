"use client";

import { useState, useTransition } from "react";
import {
  addMember,
  createTeam,
  deleteTeam,
  removeMember,
  setTeamSections,
  type ActionResult,
} from "./actions";

export type TeamRow = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  sections: string[];
  members: { id: string; name: string | null; email: string; since: string }[];
};

type SectionRow = { key: string; label: string; icon: string; entries: string[] };

const BTN =
  "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-bold transition-all active:scale-95 disabled:opacity-40";

/**
 * Attribution des droits internes.
 *
 * Une carte par équipe : ce qu'elle ouvre, et qui en fait partie. Les deux
 * ensemble, parce qu'on ne juge pas d'un droit sans voir à qui il profite.
 *
 * L'accès complet est traité à part, en haut de la liste des chapitres : ce
 * n'est pas « toutes les cases cochées », c'est une décision différente, qui
 * survivra à l'ajout du prochain écran.
 */
export default function TeamsManager({
  teams,
  sections,
  unassigned,
}: {
  teams: TeamRow[];
  sections: SectionRow[];
  unassigned: { id: string; name: string | null; email: string }[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");

  function run(fn: () => Promise<ActionResult>) {
    setError(null);
    start(async () => {
      const res = await fn().catch((e) => ({
        ok: false as const,
        error: e instanceof Error ? e.message : "Action impossible",
      }));
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-xl bg-[#fff1f0] px-4 py-3 text-sm font-semibold text-[#ba1a1a]">
          {error}
        </p>
      )}

      {unassigned.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
            {unassigned.length} administrateur{unassigned.length > 1 ? "s" : ""} sans équipe
          </p>
          <p className="mt-1 text-sm leading-relaxed text-amber-900">
            Faute d&apos;équipe, {unassigned.length > 1 ? "ils gardent" : "il garde"} l&apos;accès
            complet : {unassigned.map((u) => u.email).join(", ")}.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="rounded-full bg-[#2f6fb8] px-5 py-2.5 text-sm font-bold text-white"
        >
          {creating ? "Annuler" : "Nouvelle équipe"}
        </button>
        <span className="text-sm tabular-nums text-slate-500">{teams.length} équipe(s)</span>
      </div>

      {creating && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Nom
              </span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex. : Modération niveau 2"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2f6fb8]"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Description
              </span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="À quoi sert cette équipe"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2f6fb8]"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            L&apos;équipe est créée sans aucun droit. Vous ouvrirez ses chapitres ensuite.
          </p>
          <button
            type="button"
            disabled={pending || label.trim().length < 2}
            onClick={() =>
              run(async () => {
                const res = await createTeam(label, description);
                if (res.ok) {
                  setLabel("");
                  setDescription("");
                  setCreating(false);
                }
                return res;
              })
            }
            className={`${BTN} mt-3 bg-[#2f6fb8] text-white`}
          >
            Créer l&apos;équipe
          </button>
        </div>
      )}

      {teams.map((team) => (
        <TeamCard key={team.id} team={team} sections={sections} pending={pending} run={run} />
      ))}
    </div>
  );
}

function TeamCard({
  team,
  sections,
  pending,
  run,
}: {
  team: TeamRow;
  sections: SectionRow[];
  pending: boolean;
  run: (fn: () => Promise<ActionResult>) => void;
}) {
  const [email, setEmail] = useState("");
  const full = team.sections.includes("*");

  function toggle(key: string) {
    const next = team.sections.includes(key)
      ? team.sections.filter((s) => s !== key)
      : [...team.sections.filter((s) => s !== "*"), key];
    run(() => setTeamSections(team.id, next));
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-extrabold text-slate-900">
            {team.label}
            {full && (
              <span className="rounded-full bg-[#2f6fb8] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Accès complet
              </span>
            )}
          </h2>
          {team.description && <p className="mt-0.5 text-sm text-slate-500">{team.description}</p>}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Supprimer l'équipe « ${team.label} » ?`)) return;
            run(() => deleteTeam(team.id));
          }}
          className="text-xs font-bold text-slate-400 hover:text-[#ba1a1a] disabled:opacity-50"
        >
          Supprimer
        </button>
      </header>

      <div className="px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Chapitres ouverts
        </p>

        {/* L'accès complet n'est pas « toutes les cases cochées » : c'est une
            décision distincte, qui vaudra aussi pour le prochain écran ajouté. */}
        <label
          className={`mt-2 flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 ${
            full ? "border-[#2f6fb8] bg-[#2f6fb8]/5" : "border-slate-200"
          }`}
        >
          <input
            type="checkbox"
            checked={full}
            disabled={pending}
            onChange={(e) => run(() => setTeamSections(team.id, e.target.checked ? ["*"] : []))}
            className="h-4 w-4"
          />
          <span>
            <span className="block text-sm font-bold text-slate-800">
              Toute l&apos;administration
            </span>
            <span className="block text-xs text-slate-500">
              Y compris les écrans ajoutés plus tard.
            </span>
          </span>
        </label>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {sections.map((s) => {
            const on = full || team.sections.includes(s.key);
            return (
              <label
                key={s.key}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 ${
                  on ? "border-[#2f6fb8]/50 bg-[#2f6fb8]/5" : "border-slate-200"
                } ${full ? "opacity-60" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={pending || full}
                  onChange={() => toggle(s.key)}
                  className="mt-0.5 h-4 w-4"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                    <span className="material-symbols-outlined text-[17px] text-[#2f6fb8]">
                      {s.icon}
                    </span>
                    {s.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
                    {s.entries.join(" · ")}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Membres ({team.members.length})
        </p>

        {team.members.length > 0 ? (
          <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {team.members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#2f6fb8]/10 text-[13px] font-bold text-[#2f6fb8]">
                  {(m.name ?? m.email).charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-800">
                    {m.name ?? "Sans nom"}
                  </span>
                  <span className="block truncate text-xs text-slate-400">{m.email}</span>
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => removeMember(team.id, m.id))}
                  className="text-xs font-bold text-slate-400 hover:text-[#ba1a1a] disabled:opacity-50"
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-400">Personne dans cette équipe.</p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="adresse@exemple.fr"
            className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2f6fb8]"
          />
          <button
            type="button"
            disabled={pending || !email.includes("@")}
            onClick={() =>
              run(async () => {
                const res = await addMember(team.id, email);
                if (res.ok) setEmail("");
                return res;
              })
            }
            className={`${BTN} bg-[#2f6fb8] text-white`}
          >
            Ajouter
          </button>
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          La personne doit déjà avoir un compte Deal&amp;Co. L&apos;accès à
          l&apos;administration lui est accordé automatiquement.
        </p>
      </div>
    </section>
  );
}

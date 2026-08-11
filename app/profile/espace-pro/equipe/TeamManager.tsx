"use client";

import { useCallback, useEffect, useState } from "react";
import WeekHoursEditor, {
  EMPTY_WEEK,
  rowsFromWeek,
  weekFromRows,
  type WeekHours,
} from "@/components/pro/WeekHoursEditor";

export type ManagedService = { id: string; label: string; section: string; durationMin: number | null };

export type ManagedMember = {
  id: string;
  /** État civil, interne au salon : il distingue deux Nathalie. */
  firstName?: string | null;
  lastName?: string | null;
  /** Ce que voit le client : le prénom, jamais le nom complet. */
  displayName: string;
  role: string | null;
  /** Photo de profil, affichée sur la fiche publique et dans l'agenda. */
  avatar: string | null;
  color: string;
  isActive: boolean;
  serviceIds: string[];
  /** Identifiant d'accès au planning, `null` tant qu'aucun n'a été généré. */
  loginId?: string | null;
  /** Toutes les boutiques où la personne travaille, origine comprise. */
  establishmentIds?: string[];
  /** Boutique qui l'a créée : elle porte son historique et ne se décoche pas. */
  homeProfileId?: string;
  hasAccess?: boolean;
};

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
  establishments = [],
  currentEstablishmentId,
}: {
  initialMembers: ManagedMember[];
  services: ManagedService[];
  /** Boutiques du groupe que ce compte administre. Vide ou seule : pas de choix à faire. */
  establishments?: { id: string; name: string }[];
  /** Établissement ouvert en ce moment — celui dont on règle les horaires. */
  currentEstablishmentId: string;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [selectedId, setSelectedId] = useState<string | null>(initialMembers[0]?.id ?? null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  /**
   * Les horaires travaillés vivent sous forme de grille, pas de lignes.
   *
   * Reconvertir à chaque rendu re-trierait les plages entre deux frappes : le
   * champ qu'on est en train de corriger changerait de place dès que l'heure
   * saisie passe avant la précédente. La grille est donc l'état, et les lignes
   * ne réapparaissent qu'au chargement et à l'enregistrement.
   */
  const [week, setWeek] = useState<WeekHours>(EMPTY_WEEK);
  // Les pauses sont une grille hebdomadaire comme les horaires : c'est la
  // même question posée à l'utilisateur, elle mérite le même écran.
  const [breakWeek, setBreakWeek] = useState<WeekHours>(EMPTY_WEEK);
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
    setWeek(weekFromRows(data.workingHours ?? []));
    setBreakWeek(weekFromRows(data.breaks ?? []));
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
  async function addMember(firstName: string, lastName: string, role: string) {
    setBusy(true);
    const res = await fetch("/api/pro/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, role: role || null }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return notify(false, data.error ?? "Ajout impossible");
    setMembers((prev) => [...prev, { ...data.member, serviceIds: [] }]);
    setSelectedId(data.member.id);
    setAdding(false);
    notify(
      true,
      `${data.member.displayName} ajouté·e. Renseignez ses horaires pour ouvrir ses créneaux, ` +
        `puis créez son accès personnel au planning.`,
    );
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
    loginUrl: string;
    /** Adresse réellement servie par l'envoi, `null` si rien n'est parti. */
    sentTo: string | null;
  } | null>(null);

  /** Membre pour lequel on demande une adresse d'envoi. */
  const [askingAccessFor, setAskingAccessFor] = useState<ManagedMember | null>(null);

  /**
   * Crée l'accès, et l'envoie si une adresse est donnée.
   *
   * L'adresse est facultative : dans un salon, l'identifiant se transmet
   * souvent de vive voix. Quand elle est fournie, la personne reçoit tout
   * directement et le salon n'a rien à recopier.
   */
  async function generateAccess(m: ManagedMember, email?: string) {
    setBusy(true);
    const res = await fetch(`/api/pro/members/${m.id}/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(email ? { email } : {}),
    });
    const data = (await res.json()) as {
      loginId?: string;
      password?: string;
      loginUrl?: string;
      sentTo?: string | null;
      notice?: string;
      error?: string;
    };
    setBusy(false);

    if (!res.ok || !data.loginId || !data.password) {
      notify(false, data.error ?? "Génération impossible.");
      return;
    }

    setAskingAccessFor(null);
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, loginId: data.loginId } : x)));
    setFreshCredentials({
      memberId: m.id,
      displayName: m.displayName,
      loginId: data.loginId,
      password: data.password,
      loginUrl: data.loginUrl ?? "/equipe/connexion",
      sentTo: data.sentTo ?? null,
    });
    notify(true, data.notice ?? `Accès créé pour ${m.displayName}.`);
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

  /**
   * Détache ou rattache une personne à une autre boutique du groupe.
   *
   * Rien n'est dupliqué : c'est la même ligne d'équipe, donc le même
   * identifiant de connexion et le même historique. Seuls changent les lieux
   * où elle est proposée à la réservation.
   */
  async function toggleEstablishment(member: ManagedMember, profileId: string) {
    const current = member.establishmentIds ?? [currentEstablishmentId];
    const next = current.includes(profileId)
      ? current.filter((id) => id !== profileId)
      : [...current, profileId];

    setBusy(true);
    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, establishmentIds: next } : m)),
    );

    const res = await fetch(`/api/pro/members/${member.id}/establishments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileIds: next }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, establishmentIds: current } : m)),
      );
      notify(false, data.error ?? "Affectation refusée");
      return;
    }
    notify(true, "Affectation enregistrée");
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
      body: JSON.stringify({
        workingHours: rowsFromWeek(week),
        breaks: rowsFromWeek(breakWeek),
      }),
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
            onClick={() => setAdding((v) => !v)}
            disabled={busy}
            className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {adding ? "Annuler" : "+ Ajouter"}
          </button>
        </div>

        {adding && <AddMemberForm busy={busy} onAdd={addMember} />}

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
                  <MemberAvatar member={m} size={36} />
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
                  onClick={() => (m.loginId ? revokeAccess(m) : setAskingAccessFor(m))}
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
        {/* Demande d'adresse avant génération : c'est le moment naturel pour
            dire où envoyer les accès, plutôt qu'un champ de plus dans la fiche. */}
        {askingAccessFor && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const value = String(new FormData(e.currentTarget).get("email") ?? "").trim();
              void generateAccess(askingAccessFor, value || undefined);
            }}
            className="mt-4 rounded-xl border border-slate-200 bg-surface-container-low p-4"
          >
            <p className="text-sm font-bold">Accès de {askingAccessFor.displayName}</p>
            <p className="text-[11px] text-outline mt-1 leading-relaxed">
              Indiquez son adresse e-mail : identifiant et mot de passe lui seront envoyés
              directement. Sans adresse, ils s&apos;affichent ici pour être recopiés.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                name="email"
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="corinne@exemple.fr (facultatif)"
                className={input + " flex-1 min-w-[220px] bg-white"}
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? "Envoi…" : "Créer et envoyer"}
              </button>
              <button
                type="button"
                onClick={() => setAskingAccessFor(null)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-on-surface-variant"
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        {freshCredentials && (
          <AccessCard
            credentials={freshCredentials}
            onCopied={(what) => notify(true, `${what} copié`)}
            onClose={() => setFreshCredentials(null)}
          />
        )}
      </section>

      {selected && (
        <>
          {/* Identité du membre : photo, nom, intitulé, couleur d'agenda */}
          <MemberIdentity
            key={selected.id}
            member={selected}
            busy={busy}
            onSave={(patch) => patchMember(selected.id, patch)}
            onError={(text) => notify(false, text)}
          />

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

          {/* Boutiques où la personne travaille. Affiché seulement quand le
              groupe en compte plusieurs : un indépendant n'a pas à lire une
              question qui n'a qu'une réponse possible. */}
          {establishments.length > 1 && (
            <section className={card}>
              <h2 className="text-base font-extrabold font-['Manrope'] mb-1">
                Où travaille {selected.displayName}
              </h2>
              <p className="text-xs text-outline mb-3">
                Une même personne peut exercer dans plusieurs boutiques. Elle garde un seul
                identifiant de connexion, et vous lui donnez des horaires propres à chaque
                établissement en basculant de boutique.
              </p>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {establishments.map((e) => {
                  const isHome = e.id === (selected.homeProfileId ?? currentEstablishmentId);
                  const checked = (selected.establishmentIds ?? [currentEstablishmentId]).includes(e.id);
                  return (
                    <label
                      key={e.id}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${
                        isHome ? "opacity-60" : "hover:bg-surface-container-low cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        // L'établissement d'origine ne se décoche pas : c'est
                        // lui qui porte la personne et son historique. Pour
                        // l'en retirer, on la désactive.
                        disabled={isHome || busy}
                        onChange={() => toggleEstablishment(selected, e.id)}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-sm">
                        {e.name}
                        {isHome && <span className="text-xs text-outline ml-1">· établissement d&apos;origine</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          )}

          {/* Horaires + pauses */}
          <section className={card}>
            <h2 className="text-base font-extrabold font-['Manrope'] mb-1">
              Horaires de {selected.displayName}
            </h2>
            <p className="text-xs text-outline mb-3">
              Même grille que les horaires d&apos;ouverture : un jour est travaillé ou non, avec
              une coupure si la journée est en deux temps.
            </p>

            <WeekHoursEditor
              value={week}
              onChange={setWeek}
              maxRangesPerDay={3}
              closedLabel="Ne travaille pas"
            />

            <h3 className="text-sm font-bold mt-5 mb-1">Pauses</h3>
            <p className="text-xs text-outline mb-3">
              Se soustraient aux horaires ci-dessus : la coupure déjeuner, le créneau de
              ménage. Même grille, pour n&apos;avoir qu&apos;une seule façon de saisir une heure.
            </p>
            <WeekHoursEditor
              value={breakWeek}
              onChange={setBreakWeek}
              maxRangesPerDay={3}
              closedLabel="Aucune pause"
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

/**
 * Pastille d'un membre : sa photo si elle existe, son initiale sinon.
 *
 * L'initiale colorée reste le repli — c'est elle qui tient l'agenda lisible
 * quand personne n'a encore envoyé de portrait, et elle ne doit jamais
 * disparaître au profit d'un rond gris.
 */
function MemberAvatar({ member, size }: { member: ManagedMember; size: number }) {
  const style = { width: size, height: size };
  if (member.avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.avatar}
        alt=""
        style={style}
        className="rounded-full object-cover shrink-0 ring-2 ring-white"
      />
    );
  }
  return (
    <span
      style={{ ...style, backgroundColor: member.color }}
      className="rounded-full flex items-center justify-center text-white text-xs font-extrabold shrink-0"
    >
      {member.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Couleurs d'agenda : un jeu court, lisible côte à côte sur une semaine. */
const PALETTE = ["#2f6fb8", "#7c3aed", "#db2777", "#059669", "#d97706", "#dc2626", "#0891b2", "#4b5563"];

/**
 * Photo, nom et intitulé d'un membre.
 *
 * La photo compte : un client qui choisit « avec Corinne » choisit une
 * personne, pas une ligne de planning. Elle part sur `/api/upload` comme
 * n'importe quelle image de la plateforme — même traitement, même stockage —
 * et n'est enregistrée sur le membre qu'une fois l'URL obtenue.
 */
/**
 * Ajout d'un membre : prénom, nom, intitulé.
 *
 * Le prénom seul deviendra le libellé public — c'est ainsi qu'un client choisit
 * « Corinne ». Le nom reste interne : il sert à distinguer deux homonymes dans
 * le carnet et à retrouver la bonne personne, il n'a pas à se retrouver sur une
 * page indexée par Google.
 */
function AddMemberForm({
  busy,
  onAdd,
}: {
  busy: boolean;
  onAdd: (firstName: string, lastName: string, role: string) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(firstName.trim(), lastName.trim(), role.trim());
      }}
      className="mb-4 rounded-xl border border-slate-200 bg-surface-container-low p-4 space-y-3"
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block text-xs font-semibold text-outline">
          Prénom
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={input}
            placeholder="Corinne"
            required
            autoFocus
          />
        </label>
        <label className="block text-xs font-semibold text-outline">
          Nom
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={input}
            placeholder="Deschamps"
          />
        </label>
      </div>
      <label className="block text-xs font-semibold text-outline">
        Intitulé (facultatif)
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={input}
          placeholder="Coloriste"
        />
      </label>
      <p className="text-[11px] text-outline leading-relaxed">
        Sur la page publique, seul le prénom apparaît. Une fois la personne ajoutée, créez son
        accès personnel : elle verra son planning, et rien d&apos;autre.
      </p>
      <button
        type="submit"
        disabled={busy || !firstName.trim()}
        className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        Ajouter à l&apos;équipe
      </button>
    </form>
  );
}

function MemberIdentity({
  member,
  busy,
  onSave,
  onError,
}: {
  member: ManagedMember;
  busy: boolean;
  onSave: (patch: Partial<ManagedMember>) => void;
  onError: (text: string) => void;
}) {
  const [firstName, setFirstName] = useState(member.firstName ?? "");
  const [lastName, setLastName] = useState(member.lastName ?? "");
  const [displayName, setDisplayName] = useState(member.displayName);
  const [role, setRole] = useState(member.role ?? "");
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      onError("Choisissez une image (JPEG, PNG, WebP).");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? `Erreur ${res.status}`);
      onSave({ avatar: data.url });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className={card}>
      <h2 className="text-base font-extrabold font-['Manrope'] mb-1">Fiche de {member.displayName}</h2>
      <p className="text-xs text-outline mb-4">
        Photo, nom et intitulé tels qu&apos;ils apparaissent sur votre page publique et au moment de
        choisir un praticien.
      </p>

      <div className="flex items-start gap-4">
        <MemberAvatar member={member} size={72} />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={`inline-flex items-center gap-1.5 rounded-full bg-surface-container-low px-4 py-2 text-xs font-bold cursor-pointer hover:bg-slate-100 ${
                uploading ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">photo_camera</span>
              {uploading ? "Envoi…" : member.avatar ? "Remplacer la photo" : "Ajouter une photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void upload(file);
                }}
              />
            </label>
            {member.avatar && (
              <button
                type="button"
                onClick={() => onSave({ avatar: null })}
                className="text-xs font-bold text-outline hover:text-rose-600"
              >
                Retirer la photo
              </button>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-outline">
              Prénom
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={input}
                placeholder="Corinne"
              />
            </label>
            <label className="block text-xs font-semibold text-outline">
              Nom
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={input}
                placeholder="Deschamps"
              />
            </label>
            <label className="block text-xs font-semibold text-outline">
              Nom affiché publiquement
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={input}
                placeholder="Corinne"
              />
              <span className="block mt-1 font-normal text-[11px] text-outline leading-relaxed">
                Vu par les clients. Le nom de famille reste interne.
              </span>
            </label>
            <label className="block text-xs font-semibold text-outline">
              Intitulé
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={input}
                placeholder="Coloriste"
              />
            </label>
          </div>

          <div>
            <span className="block text-xs font-semibold text-outline mb-1.5">Couleur dans l&apos;agenda</span>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onSave({ color })}
                  aria-label={`Couleur ${color}`}
                  aria-pressed={member.color.toLowerCase() === color}
                  style={{ backgroundColor: color }}
                  className={`w-7 h-7 rounded-full ${
                    member.color.toLowerCase() === color ? "ring-2 ring-offset-2 ring-slate-400" : ""
                  }`}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={busy || !displayName.trim()}
            onClick={() =>
              onSave({
                firstName: firstName.trim() || null,
                lastName: lastName.trim() || null,
                displayName: displayName.trim(),
                role: role.trim() || null,
              })
            }
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </section>
  );
}


/**
 * Accès fraîchement créés : à lire, à copier, à transmettre.
 *
 * Le mot de passe n'existe en clair qu'ici et dans l'e-mail envoyé — la base
 * n'en garde que l'empreinte. D'où les boutons de copie : recopier huit
 * caractères à la main dans un salon plein, c'est une faute de frappe garantie
 * et un appel de plus le lendemain.
 */
function AccessCard({
  credentials,
  onCopied,
  onClose,
}: {
  credentials: {
    displayName: string;
    loginId: string;
    password: string;
    loginUrl: string;
    sentTo: string | null;
  };
  onCopied: (what: string) => void;
  onClose: () => void;
}) {
  const message =
    `Bonjour ${credentials.displayName}, voici votre accès à votre planning :\n` +
    `Identifiant : ${credentials.loginId}\n` +
    `Mot de passe : ${credentials.password}\n` +
    `Connexion : ${credentials.loginUrl}\n` +
    `À changer à la première connexion.`;

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value);
      onCopied(what);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : le texte
      // reste sélectionnable à la main, on ne bloque personne.
    }
  };

  return (
    <div className="mt-4 rounded-xl border-2 border-primary/30 bg-[#f5f9ff] p-4">
      <p className="text-sm font-extrabold text-primary">Accès de {credentials.displayName}</p>
      <p className="text-[11px] text-outline mt-1 leading-relaxed">
        {credentials.sentTo
          ? `Envoyés à ${credentials.sentTo}. Le mot de passe n'est affiché qu'une fois : s'il est perdu, il faudra en générer un nouveau.`
          : "Transmettez-les à la personne concernée. Le mot de passe n'est affiché qu'une fois : s'il est perdu, il faudra en générer un nouveau."}
      </p>

      <dl className="mt-3 space-y-2">
        <Field label="Identifiant" value={credentials.loginId} onCopy={() => copy(credentials.loginId, "Identifiant")} />
        <Field label="Mot de passe" value={credentials.password} onCopy={() => copy(credentials.password, "Mot de passe")} />
        <Field label="Connexion" value={credentials.loginUrl} onCopy={() => copy(credentials.loginUrl, "Lien")} />
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copy(message, "Message complet")}
          className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-white"
        >
          Copier le message complet
        </button>
        {/* Repli quand l'e-mail n'a pas été utilisé : le salon envoie par SMS
            ou par sa messagerie habituelle, sans rien retaper. */}
        <a
          href={`sms:?&body=${encodeURIComponent(message)}`}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-on-surface-variant"
        >
          Envoyer par SMS
        </a>
        <button type="button" onClick={onClose} className="text-xs font-bold text-outline underline px-2">
          J&apos;ai noté, masquer
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="text-[10px] uppercase font-bold tracking-wider text-outline w-24 shrink-0">
        {label}
      </dt>
      <dd className="font-mono font-bold select-all break-all flex-1">{value}</dd>
      <button
        type="button"
        onClick={onCopy}
        title={`Copier : ${label.toLowerCase()}`}
        className="shrink-0 text-outline hover:text-primary"
      >
        <span className="material-symbols-outlined text-[18px]">content_copy</span>
      </button>
    </div>
  );
}

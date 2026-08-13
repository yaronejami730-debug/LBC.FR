"use client";

import { useCallback, useEffect, useState } from "react";

type AccessRow = {
  id: string;
  role: string;
  createdAt: string;
  establishmentIds: string[];
  user: { id: string; name: string | null; email: string; avatar: string | null; lastLoginAt: string | null };
};

const ROLE_LABEL: Record<string, { label: string; help: string }> = {
  OWNER: {
    label: "Propriétaire",
    help: "Tout, y compris les données légales, la facturation et la suppression d'un établissement.",
  },
  ADMIN: {
    label: "Administrateur",
    help: "Toute l'entreprise sauf le légal et la facturation.",
  },
  MANAGER: {
    label: "Responsable",
    help: "Limité aux établissements cochés : agenda, équipe, fiche.",
  },
};

const input =
  "w-full bg-surface-container-low rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 border border-transparent focus:border-primary/30";

/**
 * Les comptes qui administrent l'entreprise, et le retrait de leur accès.
 *
 * À distinguer de l'équipe : un membre d'équipe est quelqu'un qu'on planifie,
 * un accès est quelqu'un qui entre dans le back-office. Confondre les deux
 * donnait à l'apprenti du samedi les mêmes droits qu'au gérant.
 */
export default function AccessManager({ currentUserId }: { currentUserId: string }) {
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [establishments, setEstablishments] = useState<{ id: string; name: string; city: string | null }[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [canManageOwners, setCanManageOwners] = useState(false);
  const [noCompany, setNoCompany] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MANAGER");
  const [scope, setScope] = useState<string[]>([]);

  const notify = (ok: boolean, text: string) => {
    setMessage({ ok, text });
    window.setTimeout(() => setMessage(null), 5000);
  };

  const load = useCallback(async () => {
    const res = await fetch("/api/pro/access");
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      notify(false, data.error ?? "Chargement impossible");
      return;
    }
    setRows(data.access ?? []);
    setEstablishments(data.establishments ?? []);
    setCanManage(Boolean(data.canManage));
    setCanManageOwners(Boolean(data.canManageOwners));
    setNoCompany(data.companyId === null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    const res = await fetch("/api/pro/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role, establishmentIds: role === "MANAGER" ? scope : [] }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return notify(false, data.error ?? "Ajout impossible");
    setEmail("");
    setScope([]);
    void load();
    notify(true, "Accès accordé.");
  }

  async function revoke(row: AccessRow) {
    const who = row.user.name || row.user.email;
    if (!window.confirm(`Retirer l'accès de ${who} ? Ses rendez-vous et son historique restent.`)) return;
    setBusy(true);
    const res = await fetch(`/api/pro/access?id=${row.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return notify(false, data.error ?? "Retrait impossible");
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    notify(true, `Accès de ${who} retiré.`);
  }

  if (loading) return <p className="text-sm text-outline">Chargement…</p>;

  if (noCompany) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-5 text-sm text-outline leading-relaxed">
        Cette fiche n&apos;est rattachée à aucune entreprise : vous en êtes le seul administrateur.
        Le partage d&apos;accès s&apos;activera dès qu&apos;un deuxième établissement sera ouvert.
      </div>
    );
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
        <h2 className="text-base font-extrabold font-['Manrope'] mb-1">Comptes qui ont accès</h2>
        <p className="text-xs text-outline mb-4">
          Ces personnes entrent dans votre back-office. Retirer un accès est immédiat et ne supprime
          ni les rendez-vous ni l&apos;historique.
        </p>

        <ul className="divide-y divide-slate-100">
          {rows.map((row) => {
            const role = ROLE_LABEL[row.role] ?? ROLE_LABEL.MANAGER;
            const isMe = row.user.id === currentUserId;
            const canRevoke =
              canManage && !isMe && (row.role !== "OWNER" || canManageOwners);
            return (
              <li key={row.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                {row.user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.user.avatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <span className="w-9 h-9 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-extrabold shrink-0">
                    {(row.user.name || row.user.email).slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold truncate">
                    {row.user.name || row.user.email}
                    {isMe && <span className="text-outline font-medium"> · vous</span>}
                  </span>
                  <span className="block text-xs text-outline truncate">
                    {row.user.email} · {role.label}
                    {row.role === "MANAGER" && row.establishmentIds.length > 0
                      ? ` · ${row.establishmentIds.length} établissement${row.establishmentIds.length > 1 ? "s" : ""}`
                      : ""}
                  </span>
                </span>
                {canRevoke ? (
                  <button
                    type="button"
                    onClick={() => revoke(row)}
                    disabled={busy}
                    title={`Retirer l'accès de ${row.user.name || row.user.email}`}
                    className="text-xs font-bold text-outline hover:text-rose-600 shrink-0 disabled:opacity-50"
                  >
                    Révoquer
                  </button>
                ) : (
                  <span className="text-[11px] text-outline shrink-0">
                    {isMe ? "—" : "Protégé"}
                  </span>
                )}
              </li>
            );
          })}
          {rows.length === 0 && <li className="py-3 text-sm text-outline">Aucun accès enregistré.</li>}
        </ul>
      </section>

      {canManage && (
        <section className="bg-white rounded-2xl border border-slate-100 p-5">
          <h2 className="text-base font-extrabold font-['Manrope'] mb-1">Donner un accès</h2>
          <p className="text-xs text-outline mb-4">
            La personne doit déjà avoir un compte Deal&amp;Co — on ne crée pas de compte à sa place.
          </p>
          <form onSubmit={invite} className="space-y-3">
            <label className="block text-xs font-semibold text-outline">
              Email du compte
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="associe@exemple.fr"
                className={input}
                required
              />
            </label>

            <label className="block text-xs font-semibold text-outline">
              Rôle
              <select value={role} onChange={(e) => setRole(e.target.value)} className={input}>
                {(canManageOwners ? ["OWNER", "ADMIN", "MANAGER"] : ["ADMIN", "MANAGER"]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r].label}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[11px] text-outline -mt-1">{ROLE_LABEL[role]?.help}</p>

            {role === "MANAGER" && establishments.length > 0 && (
              <div>
                <span className="block text-xs font-semibold text-outline mb-1.5">
                  Établissements confiés
                </span>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {establishments.map((e) => (
                    <label
                      key={e.id}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 hover:bg-surface-container-low cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={scope.includes(e.id)}
                        onChange={() =>
                          setScope((prev) =>
                            prev.includes(e.id) ? prev.filter((id) => id !== e.id) : [...prev, e.id],
                          )
                        }
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-sm truncate">
                        {e.name}
                        {e.city && <span className="text-outline text-xs"> · {e.city}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? "Enregistrement…" : "Donner l'accès"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}

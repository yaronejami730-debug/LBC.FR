"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type AdminAdvertiser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
  siret: string | null;
  loginId: string;
  mustChangePassword: boolean;
  suspendedAt: string | null;
  balanceCents: number;
  lastLoginAt: string | null;
  createdAt: string;
};

type Credentials = { name: string; loginId: string; password: string; sent: boolean; notice: string };

const input =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#2f6fb8]";
const label = "text-[11px] font-bold uppercase tracking-wider text-slate-500";

const euros = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/**
 * Gestion des annonceurs.
 *
 * Le formulaire ne demande que trois choses obligatoires — prénom, nom,
 * adresse. Tout le reste est facultatif, SIRET compris : exiger un SIRET
 * fermerait la porte à l'artisan qui veut trois bannières, alors que c'est
 * exactement le client qu'on cherche.
 */
export default function AdvertisersManager({ initial }: { initial: AdminAdvertiser[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  async function create(form: HTMLFormElement) {
    const data = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/advertisers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "Création impossible");
        return;
      }
      setCredentials({
        name: String(data.company || `${data.firstName} ${data.lastName}`),
        loginId: payload.credentials.loginId,
        password: payload.credentials.password,
        sent: payload.sent,
        notice: payload.notice,
      });
      setCreating(false);
      form.reset();
      router.refresh();
    } catch {
      setError("Connexion interrompue, réessayez");
    } finally {
      setBusy(false);
    }
  }

  async function resend(a: AdminAdvertiser) {
    if (!window.confirm(`Régénérer les accès de ${a.company || a.firstName} ? L'ancien mot de passe cessera de fonctionner.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/advertisers/${a.id}/resend-access`, { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? "Renvoi impossible");
        return;
      }
      setCredentials({
        name: a.company || `${a.firstName} ${a.lastName}`,
        loginId: payload.credentials.loginId,
        password: payload.credentials.password,
        sent: payload.sent,
        notice: payload.notice,
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleSuspend(a: AdminAdvertiser) {
    setBusy(true);
    try {
      await fetch(`/api/admin/advertisers/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspended: !a.suspendedAt }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="rounded-full bg-[#2f6fb8] px-5 py-2.5 text-sm font-bold text-white"
        >
          {creating ? "Annuler" : "Nouvel annonceur"}
        </button>
        <span className="text-sm text-slate-500 tabular-nums">{initial.length} annonceur(s)</span>
      </div>

      {error && (
        <p className="rounded-xl bg-[#fbe6e4] px-4 py-3 text-sm font-semibold text-[#ba1a1a]">{error}</p>
      )}

      {credentials && (
        <div className="rounded-2xl border-2 border-[#2f6fb8]/30 bg-[#f5f9ff] p-5">
          <p className="text-sm font-extrabold text-[#2f6fb8]">Accès de {credentials.name}</p>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{credentials.notice}</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-baseline gap-3">
              <dt className="w-28 shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Identifiant
              </dt>
              <dd className="font-mono font-bold select-all">{credentials.loginId}</dd>
            </div>
            <div className="flex items-baseline gap-3">
              <dt className="w-28 shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Mot de passe
              </dt>
              <dd className="font-mono font-bold select-all">{credentials.password}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard
                .writeText(
                  `Identifiant : ${credentials.loginId}\nMot de passe : ${credentials.password}\nConnexion : /annonceur/connexion`,
                )
                .catch(() => {});
            }}
            className="mt-3 rounded-full bg-[#2f6fb8] px-4 py-2 text-xs font-bold text-white"
          >
            Copier les accès
          </button>
          <button
            type="button"
            onClick={() => setCredentials(null)}
            className="ml-2 text-xs font-bold text-slate-500 underline"
          >
            Masquer
          </button>
        </div>
      )}

      {creating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void create(e.currentTarget);
          }}
          className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={label} htmlFor="firstName">Prénom *</label>
              <input id="firstName" name="firstName" required className={input + " mt-1"} />
            </div>
            <div>
              <label className={label} htmlFor="lastName">Nom *</label>
              <input id="lastName" name="lastName" required className={input + " mt-1"} />
            </div>
            <div>
              <label className={label} htmlFor="email">E-mail *</label>
              <input id="email" name="email" type="email" required className={input + " mt-1"} />
            </div>
            <div>
              <label className={label} htmlFor="phone">Téléphone</label>
              <input id="phone" name="phone" className={input + " mt-1"} />
            </div>
            <div>
              <label className={label} htmlFor="company">Société</label>
              <input id="company" name="company" className={input + " mt-1"} />
            </div>
            <div>
              <label className={label} htmlFor="siret">SIRET</label>
              <input id="siret" name="siret" className={input + " mt-1"} />
            </div>
            <div className="sm:col-span-2">
              <label className={label} htmlFor="addressLine">Adresse</label>
              <input id="addressLine" name="addressLine" className={input + " mt-1"} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="postalCode">Code postal</label>
                <input id="postalCode" name="postalCode" className={input + " mt-1"} />
              </div>
              <div>
                <label className={label} htmlFor="city">Ville</label>
                <input id="city" name="city" className={input + " mt-1"} />
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Seuls prénom, nom et e-mail sont obligatoires. Les accès partent par e-mail dès la
            création et s&apos;affichent ici une seule fois.
          </p>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[#2f6fb8] px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? "Création…" : "Créer et envoyer les accès"}
          </button>
        </form>
      )}

      {initial.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <p className="font-bold text-slate-900">Aucun annonceur</p>
          <p className="text-sm text-slate-500 mt-1">
            Créez le premier compte : il recevra ses accès immédiatement.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Annonceur", "Identifiant", "Solde", "Dernière connexion", "Créé", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {initial.map((a) => (
                <tr key={a.id} className={a.suspendedAt ? "opacity-55" : ""}>
                  <td className="px-4 py-3">
                    <span className="font-bold text-slate-900 block">
                      {a.company || `${a.firstName} ${a.lastName}`}
                    </span>
                    <span className="text-xs text-slate-500">{a.email}</span>
                    {a.suspendedAt && (
                      <span className="ml-2 rounded-full bg-[#fbe6e4] px-2 py-0.5 text-[10px] font-bold text-[#ba1a1a]">
                        suspendu
                      </span>
                    )}
                    {a.mustChangePassword && !a.suspendedAt && (
                      <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        accès non utilisé
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{a.loginId}</td>
                  <td className="px-4 py-3 tabular-nums">{euros(a.balanceCents)}</td>
                  <td className="px-4 py-3 text-slate-500">{date(a.lastLoginAt)}</td>
                  <td className="px-4 py-3 text-slate-500">{date(a.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => resend(a)}
                        disabled={busy}
                        className="text-xs font-bold text-[#2f6fb8] hover:underline disabled:opacity-50"
                      >
                        Renvoyer les accès
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSuspend(a)}
                        disabled={busy}
                        className="text-xs font-bold text-slate-500 hover:text-[#ba1a1a] disabled:opacity-50"
                      >
                        {a.suspendedAt ? "Réactiver" : "Suspendre"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

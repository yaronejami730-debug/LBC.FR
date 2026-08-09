"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  removeListingAction,
  restoreListingAction,
  purgeListingAction,
  watchAccountAction,
  unwatchAccountAction,
  banAccountAction,
  unbanAccountAction,
  purgeBannedAccountsAction,
} from "./actions";

/**
 * Boutons d'action du centre de sécurité.
 *
 * Deux niveaux de friction, calés sur la réversibilité :
 *
 * - **Réversible** (retirer, surveiller, bannir) → une boîte, un motif, on
 *   valide. Le motif est obligatoire quand il part par email : une décision
 *   de modération sans explication est incompréhensible côté utilisateur.
 * - **Irréversible** (suppression définitive) → deux écrans, dont un où il
 *   faut taper le mot SUPPRIMER. Le nombre exact de comptes concernés est
 *   rappelé aux deux étapes, jamais un « ces éléments » vague.
 *
 * Le serveur revérifie le mot de confirmation : ce qui suit n'est qu'un
 * garde-fou d'interface.
 */

const btn =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-wait";

function Icon({ name }: { name: string }) {
  return (
    <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
      {name}
    </span>
  );
}

function Modal({
  title,
  tone = "neutral",
  children,
  onClose,
}: {
  title: string;
  tone?: "neutral" | "danger";
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className={`text-lg font-extrabold mb-4 ${tone === "danger" ? "text-rose-700" : "text-slate-900"}`}
        >
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3">
      {message}
    </p>
  );
}

// ── Annonces ──────────────────────────────────────────────────────────────────

const REMOVAL_REASONS = [
  "Contenu interdit ou illégal",
  "Annonce trompeuse ou frauduleuse",
  "Photos ne correspondant pas au bien",
  "Coordonnées ou données personnelles dans l'annonce",
  "Catégorie manifestement incorrecte",
  "Activité professionnelle depuis un compte particulier",
  "Doublon d'une annonce existante",
];

export function RemoveListingButton({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    start(async () => {
      try {
        await removeListingAction(listingId, reason);
        setOpen(false);
        setReason("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Échec du retrait");
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`${btn} bg-amber-50 text-amber-700 hover:bg-amber-100`}
      >
        <Icon name="visibility_off" /> Retirer
      </button>

      {open && (
        <Modal title="Retirer cette annonce" onClose={() => !pending && setOpen(false)}>
          <ErrorLine message={error} />
          <p className="text-sm text-slate-600 mb-4">
            L'annonce devient invisible immédiatement. Son auteur la conserve 21 jours dans son
            espace personnel pour la corriger, puis elle est définitivement supprimée.
          </p>

          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Motif envoyé à l'utilisateur
          </label>
          <select
            value={REMOVAL_REASONS.includes(reason) ? reason : ""}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2"
          >
            <option value="">— Motif personnalisé —</option>
            {REMOVAL_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Précisez le motif…"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />

          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={() => setOpen(false)}
              disabled={pending}
              className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`}
            >
              Annuler
            </button>
            <button
              onClick={submit}
              disabled={pending || !reason.trim()}
              className={`${btn} bg-amber-600 text-white hover:bg-amber-700`}
            >
              {pending ? "Retrait…" : "Retirer l'annonce"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function RestoreListingButton({ listingId }: { listingId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <button
      title={error ?? undefined}
      onClick={() =>
        start(async () => {
          try {
            await restoreListingAction(listingId);
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Échec");
          }
        })
      }
      disabled={pending}
      className={`${btn} ${error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
    >
      <Icon name="check_circle" /> {error ? "Échec" : pending ? "…" : "Remettre en ligne"}
    </button>
  );
}

export function PurgeListingButton({ listingId, title }: { listingId: string; title: string }) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [word, setWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function close() {
    if (pending) return;
    setStep(0);
    setWord("");
    setError(null);
  }

  return (
    <>
      <button
        onClick={() => setStep(1)}
        className={`${btn} bg-rose-50 text-rose-700 hover:bg-rose-100`}
      >
        <Icon name="delete_forever" /> Supprimer
      </button>

      {step === 1 && (
        <Modal title="Supprimer définitivement cette annonce ?" tone="danger" onClose={close}>
          <p className="text-sm text-slate-600 mb-2">
            « {title} » sera détruite immédiatement, avec ses photos, ses signalements et ses
            conversations.
          </p>
          <p className="text-sm font-bold text-rose-700 mb-5">Cette action est irréversible.</p>
          <div className="flex justify-end gap-2">
            <button onClick={close} className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
              Annuler
            </button>
            <button onClick={() => setStep(2)} className={`${btn} bg-rose-600 text-white hover:bg-rose-700`}>
              Continuer
            </button>
          </div>
        </Modal>
      )}

      {step === 2 && (
        <Modal title="Confirmation définitive" tone="danger" onClose={close}>
          <ErrorLine message={error} />
          <p className="text-sm text-slate-600 mb-3">
            Tapez <strong className="text-rose-700">SUPPRIMER</strong> pour confirmer.
          </p>
          <input
            autoFocus
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="SUPPRIMER"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono tracking-widest"
          />
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={close} disabled={pending} className={`${btn} bg-slate-100 text-slate-700`}>
              Annuler
            </button>
            <button
              disabled={pending || word.trim().toUpperCase() !== "SUPPRIMER"}
              onClick={() =>
                start(async () => {
                  setError(null);
                  try {
                    await purgeListingAction(listingId, word);
                    close();
                    router.refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Échec de la suppression");
                  }
                })
              }
              className={`${btn} bg-rose-600 text-white hover:bg-rose-700`}
            >
              {pending ? "Suppression…" : "Supprimer définitivement"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Comptes ───────────────────────────────────────────────────────────────────

export function WatchButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`}
      >
        <Icon name="visibility" /> Surveiller
      </button>

      {open && (
        <Modal title="Mettre ce compte sous surveillance" onClose={() => !pending && setOpen(false)}>
          <ErrorLine message={error} />
          <p className="text-sm text-slate-600 mb-4">
            Aucun effet sur le compte : ni restriction, ni notification. Il apparaîtra simplement
            dans l'onglet « Sous surveillance » pour être revu.
          </p>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Pourquoi le surveiller ? (visible des modérateurs uniquement)
          </label>
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Ex. : annonces limites, plusieurs signalements sans suite…"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setOpen(false)} disabled={pending} className={`${btn} bg-slate-100 text-slate-700`}>
              Annuler
            </button>
            <button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  try {
                    await watchAccountAction(userId, reason);
                    setOpen(false);
                    setReason("");
                    router.refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Échec");
                  }
                })
              }
              className={`${btn} bg-slate-800 text-white hover:bg-slate-900`}
            >
              {pending ? "…" : "Mettre sous surveillance"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function UnwatchButton({ userId }: { userId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          await unwatchAccountAction(userId).catch(() => {});
          router.refresh();
        })
      }
      className={`${btn} bg-slate-100 text-slate-600 hover:bg-slate-200`}
    >
      <Icon name="visibility_off" /> {pending ? "…" : "Ne plus surveiller"}
    </button>
  );
}

const BAN_REASONS = [
  "Arnaque ou tentative d'escroquerie",
  "Faux compte / usurpation d'identité",
  "Multi-comptes après sanction",
  "Contenu illégal",
  "Harcèlement ou propos haineux",
  "Spam massif",
];

export function BanButton({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`${btn} bg-rose-50 text-rose-700 hover:bg-rose-100`}
      >
        <Icon name="gavel" /> Bannir
      </button>

      {open && (
        <Modal title={`Bannir ${userName}`} tone="danger" onClose={() => !pending && setOpen(false)}>
          <ErrorLine message={error} />
          <p className="text-sm text-slate-600 mb-4">
            Le compte devient inaccessible et ses annonces en ligne sont retirées. L'empreinte
            anti-réinscription est enregistrée immédiatement. Le compte rejoint l'onglet
            « Comptes bannis » — il n'est pas supprimé à ce stade.
          </p>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Motif</label>
          <select
            value={BAN_REASONS.includes(reason) ? reason : ""}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2"
          >
            <option value="">— Motif personnalisé —</option>
            {BAN_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Précisez le motif…"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setOpen(false)} disabled={pending} className={`${btn} bg-slate-100 text-slate-700`}>
              Annuler
            </button>
            <button
              disabled={pending || !reason.trim()}
              onClick={() =>
                start(async () => {
                  setError(null);
                  try {
                    await banAccountAction(userId, reason);
                    setOpen(false);
                    setReason("");
                    router.refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Échec du bannissement");
                  }
                })
              }
              className={`${btn} bg-rose-600 text-white hover:bg-rose-700`}
            >
              {pending ? "…" : "Bannir le compte"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function UnbanButton({ userId }: { userId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          await unbanAccountAction(userId).catch(() => {});
          router.refresh();
        })
      }
      className={`${btn} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
    >
      <Icon name="lock_open" /> {pending ? "…" : "Lever le bannissement"}
    </button>
  );
}

/**
 * Suppression définitive de comptes bannis — un seul ou tout le lot.
 *
 * Le composant sert les deux cas parce que la protection doit être identique :
 * il n'y a aucune raison qu'un compte supprimé à l'unité passe par moins de
 * garde-fous qu'un compte supprimé en masse.
 */
export function PurgeBannedButton({
  userIds,
  label,
  variant = "bulk",
}: {
  userIds: string[];
  label: string;
  variant?: "bulk" | "row";
}) {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [word, setWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const count = userIds.length;

  function close() {
    if (pending) return;
    setStep(0);
    setWord("");
    setError(null);
  }

  if (count === 0 && variant === "bulk") return null;

  return (
    <>
      <button
        onClick={() => setStep(1)}
        className={
          variant === "bulk"
            ? "inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition-colors shadow-sm"
            : `${btn} bg-rose-50 text-rose-700 hover:bg-rose-100`
        }
      >
        <Icon name="delete_forever" /> {label}
      </button>

      {result && (
        <p className="mt-2 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
          {result}
        </p>
      )}

      {step === 1 && (
        <Modal
          title={
            count === 1
              ? "Supprimer définitivement ce compte ?"
              : `Supprimer définitivement ces ${count} comptes ?`
          }
          tone="danger"
          onClose={close}
        >
          <p className="text-sm text-slate-600 mb-2">
            Toutes les données personnelles seront effacées : profil, annonces, photos, fichiers,
            favoris, notifications et messages dont la conservation n'est pas requise.
          </p>
          <p className="text-sm text-slate-600 mb-2">
            Seule l'empreinte anti-réinscription est conservée, sous forme de hachage, afin
            d'empêcher la recréation d'un compte.
          </p>
          <p className="text-sm font-bold text-rose-700 mb-5">Cette action est irréversible.</p>
          <div className="flex justify-end gap-2">
            <button onClick={close} className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
              Annuler
            </button>
            <button onClick={() => setStep(2)} className={`${btn} bg-rose-600 text-white hover:bg-rose-700`}>
              Continuer
            </button>
          </div>
        </Modal>
      )}

      {step === 2 && (
        <Modal title="Confirmation définitive" tone="danger" onClose={close}>
          <ErrorLine message={error} />
          <p className="text-sm text-slate-600 mb-1">
            {count === 1
              ? "1 compte va être détruit."
              : `${count} comptes vont être détruits.`}
          </p>
          <p className="text-sm text-slate-600 mb-3">
            Tapez <strong className="text-rose-700">SUPPRIMER</strong> pour confirmer.
          </p>
          <input
            autoFocus
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="SUPPRIMER"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono tracking-widest"
          />
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={close} disabled={pending} className={`${btn} bg-slate-100 text-slate-700`}>
              Annuler
            </button>
            <button
              disabled={pending || word.trim().toUpperCase() !== "SUPPRIMER"}
              onClick={() =>
                start(async () => {
                  setError(null);
                  try {
                    const res = await purgeBannedAccountsAction(userIds, word, count);
                    close();
                    const parts = [`${res.purged} compte(s) supprimé(s)`];
                    if (res.anonymized > 0) {
                      parts.push(
                        `${res.anonymized} anonymisé(s) — écritures comptables à conserver`,
                      );
                    }
                    if (res.failed.length > 0) parts.push(`${res.failed.length} échec(s)`);
                    setResult(parts.join(" · "));
                    router.refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Échec de la suppression");
                  }
                })
              }
              className={`${btn} bg-rose-600 text-white hover:bg-rose-700`}
            >
              {pending ? "Suppression…" : "Supprimer définitivement"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

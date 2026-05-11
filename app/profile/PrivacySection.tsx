"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PrivacySectionProps {
  marketingConsent: boolean;
  consentGivenAt: string | null;
}

export default function PrivacySection({ marketingConsent: initialMarketing, consentGivenAt }: PrivacySectionProps) {
  const router = useRouter();
  const [marketing, setMarketing] = useState(initialMarketing);
  const [savingMarketing, setSavingMarketing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"confirm" | "password">("confirm");

  async function toggleMarketing() {
    setSavingMarketing(true);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketingConsent: !marketing }),
      });
      setMarketing((v) => !v);
    } finally {
      setSavingMarketing(false);
    }
  }

  async function handleDeleteAccount() {
    if (!deletePassword) {
      setDeleteError("Veuillez entrer votre mot de passe.");
      return;
    }
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.error ?? "Une erreur est survenue.");
        setDeleting(false);
        return;
      }
      router.push("/?compte=supprime");
    } catch {
      setDeleteError("Erreur réseau. Réessayez.");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4 mt-6">
      <h3 className="text-lg font-extrabold text-on-surface font-['Manrope']">Confidentialité & données</h3>

      {/* Consentements */}
      <div className="bg-white rounded-2xl border border-surface-container divide-y divide-surface-container shadow-[0_2px_12px_rgba(21,21,125,0.04)]">

        {/* Date consentement */}
        <div className="px-5 py-4 flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-on-surface">CGU & Politique de confidentialité</p>
            <p className="text-xs text-outline mt-0.5">
              {consentGivenAt
                ? `Acceptées le ${new Date(consentGivenAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
                : "Acceptées lors de votre inscription"}
            </p>
            <div className="flex gap-3 mt-2">
              <Link href="/cgu" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline font-medium">
                Consulter les CGU
              </Link>
              <Link href="/confidentialite" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline font-medium">
                Politique de confidentialité
              </Link>
            </div>
          </div>
        </div>

        {/* Préférence marketing */}
        <div className="px-5 py-4 flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[18px]">mail</span>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-on-surface">E-mails promotionnels</p>
            <p className="text-xs text-outline mt-0.5">Nouveautés, offres et actualités Deal&amp;Co</p>
          </div>
          <button
            onClick={toggleMarketing}
            disabled={savingMarketing}
            aria-label={marketing ? "Désactiver les e-mails promotionnels" : "Activer les e-mails promotionnels"}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
              marketing ? "bg-primary" : "bg-outline/30"
            } ${savingMarketing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                marketing ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Droits RGPD */}
        <div className="px-5 py-4 flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-primary text-[18px]">shield_person</span>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-on-surface">Exercer mes droits RGPD</p>
            <p className="text-xs text-outline mt-0.5 leading-relaxed">
              Accès, rectification, portabilité, suppression — vous disposez de droits sur vos données.
            </p>
            <a
              href="mailto:contact@dealandcompany.fr?subject=Demande%20RGPD"
              className="inline-flex items-center gap-1.5 mt-2 text-xs text-primary hover:underline font-medium"
            >
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              Contacter le DPO
            </a>
          </div>
        </div>

        {/* Hébergement */}
        <div className="px-5 py-4 flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-primary text-[18px]">dns</span>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-on-surface">Hébergement des données</p>
            <p className="text-xs text-outline mt-0.5 leading-relaxed">
              Vos données personnelles sont stockées dans l'Union européenne (Irlande, eu-west-1), conformément au RGPD.
            </p>
          </div>
        </div>
      </div>

      {/* Zone danger — suppression */}
      <div className="bg-white rounded-2xl border border-red-100 shadow-[0_2px_12px_rgba(239,68,68,0.04)]">
        <div className="px-5 py-4 flex items-start gap-3">
          <span className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-red-500 text-[18px]">delete_forever</span>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-on-surface">Supprimer mon compte</p>
            <p className="text-xs text-outline mt-0.5 leading-relaxed">
              Supprime définitivement votre compte et toutes vos données personnelles dans un délai de 30 jours.
            </p>
            <button
              onClick={() => { setShowDeleteModal(true); setDeleteStep("confirm"); setDeleteError(""); setDeletePassword(""); }}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 hover:underline transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">delete</span>
              Supprimer mon compte
            </button>
          </div>
        </div>
      </div>

      {/* Modal suppression */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {deleteStep === "confirm" ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-red-500 text-2xl">warning</span>
                </div>
                <h3 className="text-lg font-extrabold text-on-surface text-center font-['Manrope'] mb-2">
                  Supprimer votre compte ?
                </h3>
                <p className="text-sm text-on-surface-variant text-center leading-relaxed mb-6">
                  Cette action est <strong>irréversible</strong>. Toutes vos annonces, messages et données personnelles seront définitivement supprimés.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => setDeleteStep("password")}
                    className="w-full py-3 bg-red-600 text-white rounded-2xl font-bold text-sm hover:bg-red-700 transition-colors"
                  >
                    Je veux supprimer mon compte
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="w-full py-3 bg-surface-container-low text-on-surface rounded-2xl font-bold text-sm hover:bg-surface-container transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-red-500 text-2xl">lock</span>
                </div>
                <h3 className="text-lg font-extrabold text-on-surface text-center font-['Manrope'] mb-2">
                  Confirmez avec votre mot de passe
                </h3>
                <p className="text-sm text-on-surface-variant text-center leading-relaxed mb-5">
                  Pour confirmer la suppression de votre compte, entrez votre mot de passe actuel.
                </p>
                <input
                  type="password"
                  placeholder="Votre mot de passe"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-red-400 outline-none mb-3"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleDeleteAccount()}
                />
                {deleteError && (
                  <p className="text-red-600 text-xs font-medium mb-3 text-center">{deleteError}</p>
                )}
                <div className="space-y-3">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting || !deletePassword}
                    className="w-full py-3 bg-red-600 text-white rounded-2xl font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? "Suppression en cours…" : "Supprimer définitivement"}
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleting}
                    className="w-full py-3 bg-surface-container-low text-on-surface rounded-2xl font-bold text-sm hover:bg-surface-container transition-colors disabled:opacity-50"
                  >
                    Annuler
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

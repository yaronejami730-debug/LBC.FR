"use client";

import { useState } from "react";
import CampaignForm from "./CampaignForm";
import BroadcastPushForm from "./BroadcastPushForm";

type Counts = React.ComponentProps<typeof CampaignForm>["counts"];
type PushAudience = { devices: number; users: number };

type TestResult = { ok: boolean; message: string } | null;

export default function NotificationsHub({ counts, pushAudience }: { counts: Counts; pushAudience: PushAudience }) {
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(true);
  const [sms, setSms] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>(null);

  const sendTestPush = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/test-push", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        setTestResult({ ok: false, message: data.error ?? `HTTP ${res.status}` });
      } else if (data.hasToken === false) {
        setTestResult({ ok: false, message: data.error ?? "Aucun appareil enregistré." });
      } else {
        setTestResult({ ok: true, message: `Push envoyé sur ${data.sent} appareil${data.sent > 1 ? "s" : ""}. Vérifiez votre téléphone.` });
      }
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : "Échec" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900">Notifications</h1>
        <p className="text-slate-500 mt-1">
          Envoyez des messages aux utilisateurs via plusieurs canaux. Choisissez les canaux d&apos;envoi puis configurez la campagne.
        </p>
      </div>

      {/* Canaux d'envoi */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 mb-4">Canaux d&apos;envoi</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ChannelToggle
            label="Notification push"
            sub="Expo Push (mobile)"
            checked={push}
            onChange={setPush}
            icon="notifications_active"
          />
          <ChannelToggle
            label="Email"
            sub="via Brevo"
            checked={email}
            onChange={setEmail}
            icon="mail"
          />
          <ChannelToggle
            label="SMS"
            sub="Twilio (à venir)"
            checked={sms}
            onChange={setSms}
            icon="sms"
            disabled
            note="Bientôt"
          />
        </div>
        <p className="text-xs text-slate-400 mt-4">
          Le push utilise les templates côté code (validation, refus, message, alerte) et s&apos;envoie automatiquement aux événements correspondants. L&apos;email passe par Brevo.
        </p>
      </div>

      {/* Diffusion push libre — message personnalisé à tous les utilisateurs */}
      {push && (
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 mb-1">Diffusion à tous les utilisateurs</h2>
          <p className="text-xs text-slate-400 mb-4">
            Rédigez un message libre (titre + corps) envoyé en push à tous les appareils mobiles actifs.
          </p>
          <BroadcastPushForm devices={pushAudience.devices} users={pushAudience.users} />
        </div>
      )}

      {/* Test push */}
      {push && (
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 mb-2">Test push</h2>
          <p className="text-sm text-slate-600 mb-4">
            Envoie une notification de bienvenue à tous les appareils enregistrés sur ce compte admin.
            <br />
            <span className="text-xs text-amber-600">Note : Expo Go ne reçoit pas les push distants. Utilisez un dev build / TestFlight.</span>
          </p>
          <button
            type="button"
            onClick={sendTestPush}
            disabled={testing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2f6fb8] text-white font-bold hover:opacity-90 disabled:opacity-60 transition"
          >
            <span className="material-symbols-outlined text-base">{testing ? "hourglass_top" : "send"}</span>
            {testing ? "Envoi…" : "Envoyer un push de test"}
          </button>
          {testResult && (
            <div className={`mt-3 px-4 py-3 rounded-xl text-sm ${
              testResult.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                            : "bg-red-50 text-red-700 border border-red-100"
            }`}>
              {testResult.message}
            </div>
          )}
        </div>
      )}

      {/* Templates système */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 mb-4">Templates système (push)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {SYSTEM_TEMPLATES.map((t) => (
            <div key={t.type} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <span className="material-symbols-outlined text-[#2f6fb8]">{t.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{t.title}</p>
                <p className="text-xs text-slate-500 truncate">{t.type}</p>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Actif</span>
            </div>
          ))}
        </div>
      </div>

      {/* Campagne email manuelle (existant) */}
      {email && (
        <div className="bg-white border border-slate-100 rounded-2xl p-5">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 mb-1">Campagne email manuelle</h2>
          <p className="text-xs text-slate-400 mb-4">Envoi via Brevo à un segment d&apos;utilisateurs.</p>
          <CampaignForm counts={counts} />
        </div>
      )}
    </div>
  );
}

function ChannelToggle({
  label, sub, checked, onChange, icon, disabled, note,
}: {
  label: string; sub: string; checked: boolean; onChange: (v: boolean) => void;
  icon: string; disabled?: boolean; note?: string;
}) {
  return (
    <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition ${
      checked ? "border-[#2f6fb8] bg-[#2f6fb8]/5" : "border-slate-200 bg-white"
    } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-5 h-5 accent-[#2f6fb8]"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#2f6fb8] text-xl">{icon}</span>
          <span className="font-bold text-slate-900">{label}</span>
          {note && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wider ml-auto">{note}</span>}
        </div>
        <p className="text-xs text-slate-500 mt-1">{sub}</p>
      </div>
    </label>
  );
}

// Liste des templates push effectivement branchés côté backend
// (cf lib/notifications/templates.ts pour la liste complète).
const SYSTEM_TEMPLATES = [
  { type: "listing_approved", title: "Annonce validée", icon: "check_circle" },
  { type: "listing_rejected", title: "Annonce refusée", icon: "block" },
  { type: "listing_pending", title: "Annonce en attente", icon: "hourglass_top" },
  { type: "new_message", title: "Nouveau message", icon: "chat" },
  { type: "listing_message", title: "Intérêt sur annonce", icon: "favorite" },
  { type: "saved_alert_match", title: "Alerte recherche", icon: "notifications_active" },
  { type: "multiple_alert_matches", title: "Plusieurs annonces alerte", icon: "notifications" },
  { type: "password_changed", title: "Mot de passe modifié", icon: "lock_reset" },
];

"use client";

import { useState } from "react";
import { sendBroadcastPush } from "@/app/admin/actions";

type Result = { ok: boolean; message: string } | null;

export default function BroadcastPushForm({ devices, users }: { devices: number; users: number }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<Result>(null);

  const valid = title.trim().length >= 2 && body.trim().length >= 3;

  const submit = async () => {
    setSending(true);
    setResult(null);
    try {
      const r = await sendBroadcastPush({ title, body, link });
      setResult({ ok: true, message: `Notification envoyée à ${r.devices} appareil${r.devices > 1 ? "s" : ""}.` });
      setTitle("");
      setBody("");
      setLink("");
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : "Échec de l'envoi" });
    } finally {
      setSending(false);
      setConfirm(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span className="material-symbols-outlined text-[#2f6fb8] text-lg">groups</span>
        <span>
          Touche <strong className="text-slate-900">{users}</strong> utilisateur{users > 1 ? "s" : ""} ·{" "}
          <strong className="text-slate-900">{devices}</strong> appareil{devices > 1 ? "s" : ""} actif{devices > 1 ? "s" : ""}
        </span>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Titre</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="ex : Nouveautés sur Deal & Co 🎉"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#2f6fb8] focus:ring-2 focus:ring-[#2f6fb8]/20 outline-none text-slate-900"
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={240}
          rows={3}
          placeholder="Le contenu de la notification…"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#2f6fb8] focus:ring-2 focus:ring-[#2f6fb8]/20 outline-none text-slate-900 resize-none"
        />
        <p className="text-[11px] text-slate-400 mt-1 text-right">{body.length}/240</p>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
          Lien à l'ouverture <span className="text-slate-300 normal-case">(optionnel)</span>
        </label>
        <input
          type="text"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="ex : /annonce/abc123  ou  /(tabs)/alertes"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#2f6fb8] focus:ring-2 focus:ring-[#2f6fb8]/20 outline-none text-slate-900"
        />
        <p className="text-[11px] text-slate-400 mt-1">Deep-link interne ouvert au tap. Vide = ouvre l&apos;app.</p>
      </div>

      {result && (
        <div className={`px-4 py-3 rounded-xl text-sm ${
          result.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                    : "bg-red-50 text-red-700 border border-red-100"
        }`}>
          {result.message}
        </div>
      )}

      {!confirm ? (
        <button
          type="button"
          disabled={!valid || sending}
          onClick={() => setConfirm(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#2f6fb8] text-white font-bold hover:opacity-90 disabled:opacity-50 transition"
        >
          <span className="material-symbols-outlined text-base">send</span>
          Envoyer à tous
        </button>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <span className="material-symbols-outlined text-amber-600">warning</span>
          <p className="text-sm text-amber-900 flex-1">
            Envoyer cette notification à <strong>{devices}</strong> appareil{devices > 1 ? "s" : ""} ? Action immédiate et irréversible.
          </p>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            disabled={sending}
            className="px-4 py-2 rounded-full text-sm font-bold text-slate-600 hover:bg-slate-100 transition"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={sending}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#2f6fb8] text-white text-sm font-bold hover:opacity-90 disabled:opacity-60 transition"
          >
            <span className="material-symbols-outlined text-base">{sending ? "hourglass_top" : "check"}</span>
            {sending ? "Envoi…" : "Confirmer l'envoi"}
          </button>
        </div>
      )}
    </div>
  );
}

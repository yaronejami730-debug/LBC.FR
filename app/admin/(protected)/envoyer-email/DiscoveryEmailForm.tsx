"use client";

import { useState } from "react";
import { sendDiscoveryEmail } from "@/app/admin/actions";

export default function DiscoveryEmailForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [sentEmails, setSentEmails] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      await sendDiscoveryEmail(email.trim());
      setSentEmails((prev) => [email.trim().toLowerCase(), ...prev]);
      setEmail("");
      setStatus("success");
      setTimeout(() => setStatus("idle"), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Erreur lors de l'envoi");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-6">
      {/* Form card */}
      <div className="bg-white rounded-2xl border border-[#eceef0] p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="discovery-email"
              className="block text-sm font-bold text-[#191c1e] mb-2"
            >
              Adresse email du destinataire
            </label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-[#777683]">
                  mail
                </span>
                <input
                  id="discovery-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@exemple.com"
                  required
                  disabled={status === "loading"}
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-[#eceef0] bg-[#f7f9fb] text-[#191c1e] text-sm placeholder:text-[#b0b3ba] focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition disabled:opacity-60"
                />
              </div>
              <button
                type="submit"
                disabled={status === "loading" || !email.trim()}
                className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#2f6fb8] text-white text-sm font-bold hover:bg-[#2563a8] active:scale-95 transition disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
              >
                {status === "loading" ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Envoi…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    Envoyer
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Feedback */}
          {status === "success" && (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm font-semibold">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
              Email envoyé avec succès !
            </div>
          )}
          {status === "error" && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-semibold">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                error
              </span>
              {errorMsg}
            </div>
          )}
        </form>
      </div>

      {/* Aperçu du contenu de l'email */}
      <div className="bg-white rounded-2xl border border-[#eceef0] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#eceef0]">
          <h2 className="font-bold text-[#191c1e] text-sm">Contenu de l&apos;email</h2>
          <p className="text-xs text-[#777683] mt-0.5">Ce que recevra le destinataire</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          {[
            {
              icon: "storefront",
              title: "Achetez & vendez localement",
              desc: "Trouvez des annonces près de chez vous — immobilier, véhicules, électronique, emploi et bien plus encore.",
            },
            {
              icon: "bolt",
              title: "Simple et rapide",
              desc: "Publiez votre première annonce en moins de 2 minutes. Ajoutez des photos, un prix, et c'est en ligne.",
            },
            {
              icon: "verified_user",
              title: "Une communauté de confiance",
              desc: "Vendeurs vérifiés, messagerie intégrée et profils détaillés pour des échanges en toute sécurité.",
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex items-start gap-4 bg-[#f7f9fb] rounded-xl p-4">
              <div className="w-9 h-9 rounded-lg bg-[#2f6fb8]/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[18px] text-[#2f6fb8]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {icon}
                </span>
              </div>
              <div>
                <p className="text-sm font-bold text-[#191c1e]">{title}</p>
                <p className="text-xs text-[#777683] mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 pb-5">
          <div className="flex items-center justify-center">
            <div className="bg-[#2f6fb8] text-white text-sm font-bold px-8 py-3 rounded-full opacity-80 cursor-default select-none">
              Découvrir la plateforme →
            </div>
          </div>
        </div>
      </div>

      {/* Historique session */}
      {sentEmails.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#eceef0] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#eceef0] flex items-center justify-between">
            <h2 className="font-bold text-[#191c1e] text-sm">Envoyés cette session</h2>
            <span className="text-[10px] bg-[#e1e0ff] text-[#2f6fb8] font-black px-2.5 py-1 rounded-full uppercase tracking-wide">
              {sentEmails.length}
            </span>
          </div>
          <ul className="divide-y divide-[#f2f4f6]">
            {sentEmails.map((e, i) => (
              <li key={i} className="flex items-center gap-3 px-6 py-3">
                <span
                  className="material-symbols-outlined text-[16px] text-emerald-500 flex-shrink-0"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
                <span className="text-sm text-[#464652]">{e}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

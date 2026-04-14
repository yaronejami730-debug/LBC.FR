"use client";

import { useState } from "react";
import { sendDiscoveryEmail } from "@/app/admin/actions";

type Target = "tous" | "pro" | "particulier";

const DOMAINS = [
  { id: "", label: "Général (tous domaines)" },
  { id: "immobilier", label: "Immobilier" },
  { id: "vehicules", label: "Automobile" },
  { id: "electronique", label: "Électronique & High-tech" },
  { id: "mode", label: "Mode & Habillement" },
  { id: "services", label: "Services" },
  { id: "emploi", label: "Emploi & Recrutement" },
  { id: "maison", label: "Maison & Décoration" },
  { id: "animaux", label: "Animaux" },
  { id: "loisirs", label: "Loisirs & Sports" },
];

const DOMAIN_LABELS: Record<string, string> = {
  immobilier: "l'immobilier",
  vehicules: "l'automobile",
  electronique: "l'électronique et le high-tech",
  mode: "la mode et l'habillement",
  services: "les services",
  emploi: "l'emploi et le recrutement",
  maison: "la maison et la décoration",
  animaux: "les animaux de compagnie",
  loisirs: "les loisirs et les sports",
};

function getPreviewIntro(target: Target, domain: string): string {
  const label = DOMAIN_LABELS[domain];
  if (target === "pro" && label)
    return `En tant que professionnel dans ${label}, vous savez combien la visibilité locale est essentielle. Deal & Co vous offre une vitrine digitale pour atteindre des clients qualifiés près de chez vous — avec zéro commission et zéro paiement. Publier une annonce est entièrement gratuit.`;
  if (target === "pro")
    return `Deal & Co est la marketplace locale conçue pour les professionnels. Publiez vos offres, touchez une clientèle qualifiée dans votre région — zéro commission, zéro frais, 100% gratuit.`;
  if (target === "particulier" && label)
    return `Que vous souhaitiez vendre, acheter ou trouver une bonne affaire dans ${label}, Deal & Co est la plateforme idéale — entièrement gratuite, sans paiement ni commission.`;
  if (target === "particulier")
    return `Avec Deal & Co, publiez une annonce en 2 minutes, trouvez des acheteurs près de chez vous — gratuitement, sans commission, sans paiement.`;
  if (label)
    return `Découvrez Deal & Co, la marketplace locale dans ${label} et bien d'autres domaines. Publiez et parcourez des annonces 100% gratuitement — aucun paiement, aucune commission.`;
  return `Découvrez Deal & Co, la marketplace locale pour acheter, vendre et échanger près de chez vous — entièrement gratuite, sans commission ni paiement.`;
}

function getPreviewFeatures(target: Target) {
  if (target === "pro") return [
    { icon: "money_off", title: "100% gratuit — zéro commission", desc: "Publiez autant d'annonces que vous voulez. Aucun abonnement, aucune commission, aucun paiement. Jamais." },
    { icon: "verified", title: "Visibilité locale & badge Pro", desc: "Touchez des milliers de clients qualifiés dans votre région. Badge Pro et profil vérifié." },
    { icon: "bolt", title: "Simple, rapide, sans contrainte", desc: "Créez votre annonce en 2 minutes — photos, prix, description. Votre vitrine en ligne." },
  ];
  if (target === "particulier") return [
    { icon: "money_off", title: "100% gratuit — sans paiement", desc: "Publiez vos annonces gratuitement. Aucune commission sur vos ventes, aucun frais caché." },
    { icon: "savings", title: "Des bonnes affaires près de chez vous", desc: "Achetez et vendez localement — sans frais de livraison." },
    { icon: "verified_user", title: "Une communauté de confiance", desc: "Profils vérifiés, messagerie intégrée et avis transparents." },
  ];
  return [
    { icon: "money_off", title: "100% gratuit pour tous", desc: "Pros comme particuliers — aucun paiement, aucune commission, aucun frais caché." },
    { icon: "storefront", title: "Achetez & vendez localement", desc: "Trouvez des annonces près de chez vous — immobilier, véhicules, électronique et plus." },
    { icon: "verified_user", title: "Une communauté de confiance", desc: "Vendeurs vérifiés, messagerie intégrée et profils détaillés." },
  ];
}

const pillCls = (active: boolean) =>
  `px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all cursor-pointer ${
    active
      ? "bg-[#2f6fb8] text-white border-[#2f6fb8] shadow-sm"
      : "bg-white text-[#464652] border-[#eceef0] hover:border-[#2f6fb8]/40"
  }`;

export default function DiscoveryEmailForm() {
  const [email, setEmail] = useState("");
  const [target, setTarget] = useState<Target>("tous");
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [sentEmails, setSentEmails] = useState<{ email: string; target: Target; domain: string }[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      await sendDiscoveryEmail(email.trim(), target, domain);
      setSentEmails((prev) => [{ email: email.trim().toLowerCase(), target, domain }, ...prev]);
      setEmail("");
      setStatus("success");
      setTimeout(() => setStatus("idle"), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Erreur lors de l'envoi");
      setStatus("error");
    }
  }

  const previewIntro = getPreviewIntro(target, domain);
  const previewFeatures = getPreviewFeatures(target);

  return (
    <div className="space-y-6">
      {/* Form card */}
      <div className="bg-white rounded-2xl border border-[#eceef0] p-6 space-y-6">

        {/* Cible */}
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-[#777683] mb-3">
            Qui visez-vous ?
          </label>
          <div className="flex flex-wrap gap-2">
            {([
              { id: "tous", label: "Tous", icon: "groups" },
              { id: "pro", label: "Professionnels", icon: "business_center" },
              { id: "particulier", label: "Particuliers", icon: "person" },
            ] as { id: Target; label: string; icon: string }[]).map(({ id, label, icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTarget(id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                  target === id
                    ? "bg-[#2f6fb8] text-white border-[#2f6fb8] shadow-sm"
                    : "bg-white text-[#464652] border-[#eceef0] hover:border-[#2f6fb8]/40"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]" style={target === id ? { fontVariationSettings: "'FILL' 1" } : {}}>
                  {icon}
                </span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Domaine */}
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-[#777683] mb-3">
            Domaine ciblé
          </label>
          <div className="flex flex-wrap gap-2">
            {DOMAINS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setDomain(id)}
                className={pillCls(domain === id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Email + Envoyer */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-xs font-black uppercase tracking-widest text-[#777683]">
            Email du destinataire
          </label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-[#777683]">
                mail
              </span>
              <input
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

          {status === "success" && (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm font-semibold">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              Email envoyé avec succès !
            </div>
          )}
          {status === "error" && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-semibold">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
              {errorMsg}
            </div>
          )}
        </form>
      </div>

      {/* Aperçu dynamique */}
      <div className="bg-white rounded-2xl border border-[#eceef0] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#eceef0] flex items-center justify-between">
          <div>
            <h2 className="font-bold text-[#191c1e] text-sm">Aperçu de l&apos;email</h2>
            <p className="text-xs text-[#777683] mt-0.5">Se met à jour en temps réel selon vos choix</p>
          </div>
          <div className="flex items-center gap-2">
            {target !== "tous" && (
              <span className="text-[11px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full bg-[#2f6fb8]/10 text-[#2f6fb8]">
                {target === "pro" ? "Pros" : "Particuliers"}
              </span>
            )}
            {domain && (
              <span className="text-[11px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full bg-[#f2f4f6] text-[#464652]">
                {DOMAINS.find((d) => d.id === domain)?.label}
              </span>
            )}
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Intro */}
          <p className="text-sm text-[#464652] leading-relaxed italic border-l-2 border-[#2f6fb8]/30 pl-4">
            {previewIntro}
          </p>

          {/* Features */}
          {previewFeatures.map(({ icon, title, desc }) => (
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

          {/* Bloc early adopter — uniquement pros */}
          {target === "pro" && (
            <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg,#1a1b25 0%,#2f3a5c 100%)" }}>
              <div className="p-5">
                <span className="inline-block bg-[#2f6fb8] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                  Offre fondateurs — 50 premiers pros
                </span>
                <p className="text-white font-black text-lg leading-tight mb-2">−50% sur toutes nos publicités, pendant 3 ans.</p>
                <p className="text-[#b0b8cc] text-xs leading-relaxed mb-3">
                  Les annonces restent gratuites pour toujours. Deal & Co se rémunère uniquement via des <strong className="text-white">espaces publicitaires</strong> (bannières, annonces sponsorisées). En rejoignant les 50 premiers pros, vous obtenez <strong className="text-[#fbbf24]">−50% pendant 3 ans</strong> sur tous nos forfaits pub.
                </p>
                <div className="bg-[#fbbf24] text-[#1a1b25] text-xs font-black px-5 py-2.5 rounded-full inline-block cursor-default select-none">
                  Je réserve ma place →
                </div>
              </div>
            </div>
          )}

          {/* Boutons CTA */}
          <div className="flex flex-col items-center gap-3 pt-1">
            <div className="bg-[#2f6fb8] text-white text-sm font-bold px-8 py-3 rounded-full opacity-90 cursor-default select-none">
              Découvrir la plateforme →
            </div>
            <div className="bg-white text-[#2f6fb8] text-sm font-bold px-8 py-3 rounded-full border-2 border-[#2f6fb8] opacity-80 cursor-default select-none">
              Créer mon compte gratuitement
            </div>
            {target === "pro" && (
              <div className="bg-[#fbbf24] text-[#1a1b25] text-sm font-black px-8 py-3 rounded-full cursor-default select-none">
                🎯 Rejoindre les 50 premiers — −50% pendant 3 ans
              </div>
            )}
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
            {sentEmails.map((entry, i) => (
              <li key={i} className="flex items-center gap-3 px-6 py-3">
                <span className="material-symbols-outlined text-[16px] text-emerald-500 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#464652] truncate">{entry.email}</p>
                  <p className="text-xs text-[#777683] mt-0.5">
                    {entry.target === "pro" ? "Professionnels" : entry.target === "particulier" ? "Particuliers" : "Tous"}
                    {entry.domain ? ` · ${DOMAINS.find((d) => d.id === entry.domain)?.label}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

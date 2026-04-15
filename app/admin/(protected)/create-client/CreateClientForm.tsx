"use client";

import { useState, useRef } from "react";
import { createClientAccount } from "@/app/admin/actions";

type CreatedClient = { userId: string; email: string; name: string };

const fieldCls =
  "w-full px-4 py-3 rounded-xl border border-[#eceef0] bg-white text-[#191c1e] text-sm focus:outline-none focus:ring-2 focus:ring-[#2f6fb8]/30 focus:border-[#2f6fb8] transition-all";
const labelCls = "block text-xs font-bold uppercase tracking-widest text-[#777683] mb-1.5";

type SiretResult = { siret: string; companyName: string | null };

export default function CreateClientForm({
  onCreated,
}: {
  onCreated: (client: CreatedClient) => void;
}) {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [accountType, setAccountType] = useState<"particulier" | "pro">("particulier");
  const [companyName, setCompanyName] = useState("");
  const [siret, setSiret] = useState("");
  const [siretStatus, setSiretStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [siretMsg, setSiretMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const siretTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSiretChange(val: string) {
    const clean = val.replace(/\s/g, "").slice(0, 14);
    setSiret(clean);
    setSiretMsg("");
    setSiretStatus("idle");
    if (siretTimer.current) clearTimeout(siretTimer.current);
    if (clean.length === 14) {
      setSiretStatus("loading");
      siretTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/siret?q=${clean}`);
          const data: SiretResult & { error?: string } = await res.json();
          if (!res.ok || data.error) {
            setSiretStatus("error");
            setSiretMsg(data.error ?? "SIRET invalide");
          } else {
            setSiretStatus("ok");
            setSiretMsg(`✓ ${data.companyName ?? "Entreprise trouvée"}`);
            if (data.companyName && !companyName) setCompanyName(data.companyName);
          }
        } catch {
          setSiretStatus("error");
          setSiretMsg("Impossible de vérifier le SIRET");
        }
      }, 600);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const fullName = `${prenom.trim()} ${nom.trim()}`.trim();
      const result = await createClientAccount(
        email.trim(),
        fullName,
        accountType === "pro",
        companyName.trim() || null,
        siret.trim() || null,
      );
      setSuccess(`Compte créé — invitation envoyée à ${result.email}`);
      onCreated(result);
      setPrenom(""); setNom(""); setEmail("");
      setAccountType("particulier"); setCompanyName(""); setSiret("");
      setSiretStatus("idle"); setSiretMsg("");
    } catch (err: any) {
      setError(err.message ?? "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Prénom / Nom */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Prénom</label>
          <input
            type="text"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            placeholder="Jean"
            required
            className={fieldCls}
          />
        </div>
        <div>
          <label className={labelCls}>Nom</label>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Dupont"
            required
            className={fieldCls}
          />
        </div>
      </div>

      {/* Email */}
      <div>
        <label className={labelCls}>Adresse email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jean@exemple.fr"
          required
          className={fieldCls}
        />
      </div>

      {/* Type de compte */}
      <div>
        <label className={labelCls}>Type de compte</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setAccountType("particulier")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
              accountType === "particulier"
                ? "border-[#2f6fb8] bg-[#2f6fb8]/5"
                : "border-[#eceef0] bg-white hover:border-[#2f6fb8]/30"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${accountType === "particulier" ? "text-[#2f6fb8]" : "text-[#9ca3af]"}`}
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              person
            </span>
            <div>
              <p className={`text-sm font-bold ${accountType === "particulier" ? "text-[#2f6fb8]" : "text-[#464652]"}`}>
                Particulier
              </p>
              <p className="text-[10px] text-[#9ca3af]">Compte personnel</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setAccountType("pro")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
              accountType === "pro"
                ? "border-[#2f6fb8] bg-[#2f6fb8]/5"
                : "border-[#eceef0] bg-white hover:border-[#2f6fb8]/30"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${accountType === "pro" ? "text-[#2f6fb8]" : "text-[#9ca3af]"}`}
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              business_center
            </span>
            <div>
              <p className={`text-sm font-bold ${accountType === "pro" ? "text-[#2f6fb8]" : "text-[#464652]"}`}>
                Professionnel
              </p>
              <p className="text-[10px] text-[#9ca3af]">Compte entreprise</p>
            </div>
          </button>
        </div>
      </div>

      {/* Champs Pro */}
      {accountType === "pro" && (
        <div className="bg-[#f8f9fb] rounded-2xl border border-[#eceef0] p-4 space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#777683]">Informations professionnelles</p>

          <div>
            <label className={labelCls}>Nom de la société <span className="text-[#9ca3af] normal-case font-normal">(optionnel)</span></label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ex : Immobilier Dupont SARL"
              className={fieldCls}
            />
          </div>

          <div>
            <label className={labelCls}>
              SIRET <span className="text-[#9ca3af] normal-case font-normal">(optionnel — sera demandé au client sinon)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={siret}
                onChange={(e) => handleSiretChange(e.target.value)}
                placeholder="14 chiffres"
                maxLength={14}
                inputMode="numeric"
                className={`${fieldCls} pr-10 font-mono ${
                  siretStatus === "error" ? "border-red-300 focus:border-red-400 focus:ring-red-200/50" :
                  siretStatus === "ok"    ? "border-emerald-300 focus:border-emerald-400 focus:ring-emerald-200/50" : ""
                }`}
              />
              {siretStatus === "loading" && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-[#2f6fb8] border-t-transparent animate-spin" />
              )}
              {siretStatus === "ok" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-emerald-500 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              )}
              {siretStatus === "error" && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-red-500 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
              )}
            </div>
            {siretMsg && (
              <p className={`text-xs mt-1.5 font-medium ${siretStatus === "ok" ? "text-emerald-600" : "text-red-500"}`}>
                {siretMsg}
              </p>
            )}
            {!siret && (
              <p className="text-[10px] text-[#9ca3af] mt-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">info</span>
                Si non renseigné, le SIRET sera demandé au client lors de l'activation de son compte.
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl border border-red-100 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error</span>
          {error}
        </p>
      )}
      {success && (
        <p className="text-emerald-700 text-sm bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 px-6 py-3 bg-[#2f6fb8] text-white rounded-xl font-bold text-sm hover:bg-[#1a5a9e] transition-all disabled:opacity-60 shadow-md shadow-[#2f6fb8]/20 active:scale-95"
      >
        <span className="material-symbols-outlined text-[18px]">person_add</span>
        {loading ? "Création en cours…" : "Créer le compte & envoyer l'invitation"}
      </button>
    </form>
  );
}

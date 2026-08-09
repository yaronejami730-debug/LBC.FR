"use client";

import { useRef, useState } from "react";

/**
 * Demande de compte professionnel.
 *
 * Le SIRET ne suffit plus à activer le badge : il est public et se recopie.
 * L'utilisateur dépose une pièce d'identité et un justificatif d'entreprise
 * (Kbis ou avis de situation SIRENE), un modérateur tranche. Le formulaire
 * n'active donc rien — il ouvre un dossier.
 */

type DocKind = "identity" | "company";

const ID_TYPES = [
  { value: "CNI", label: "Carte nationale d'identité" },
  { value: "PASSEPORT", label: "Passeport" },
  { value: "TITRE_SEJOUR", label: "Titre de séjour" },
];

const COMPANY_DOC_TYPES = [
  { value: "KBIS", label: "Extrait Kbis" },
  { value: "AVIS_SIRENE", label: "Avis de situation SIRENE" },
];

export default function UpgradePro({
  pending = false,
  infoRequest = null,
}: {
  pending?: boolean;
  /** Complément réclamé par un modérateur : le dossier reste ouvert. */
  infoRequest?: string | null;
}) {
  const [siret, setSiret] = useState("");
  const [companyName, setCompanyName] = useState("");
  // Champs entreprise de la demande d'habilitation. Le SIREN est déduit du
  // SIRET (ses 9 premiers chiffres) mais reste modifiable.
  const [biz, setBiz] = useState({
    siren: "",
    commercialName: "",
    businessAddress: "",
    businessActivity: "",
    businessCategory: "",
    responsibleFirstName: "",
    responsibleLastName: "",
    professionalPhone: "",
    professionalEmail: "",
  });
  const setB = (k: keyof typeof biz, v: string) => setBiz((prev) => ({ ...prev, [k]: v }));
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [idType, setIdType] = useState("CNI");
  const [companyDocType, setCompanyDocType] = useState("KBIS");
  const [idPath, setIdPath] = useState("");
  const [companyPath, setCompanyPath] = useState("");
  const [idName, setIdName] = useState("");
  const [companyDocName, setCompanyDocName] = useState("");
  const [uploading, setUploading] = useState<DocKind | null>(null);

  const idInput = useRef<HTMLInputElement>(null);
  const companyInput = useRef<HTMLInputElement>(null);

  async function handleSiretChange(value: string) {
    const clean = value.replace(/\s/g, "").slice(0, 14);
    setSiret(clean);
    setCompanyName("");
    if (clean.length >= 9) setB("siren", clean.slice(0, 9));
    setError("");

    if (clean.length === 14) {
      setChecking(true);
      try {
        const res = await fetch(`/api/siret?q=${clean}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "SIRET invalide");
        } else {
          setCompanyName(data.companyName ?? "");
          if (!data.companyName) setError("Nom d'entreprise introuvable pour ce SIRET");
        }
      } catch {
        setError("Impossible de vérifier le SIRET");
      } finally {
        setChecking(false);
      }
    }
  }

  async function uploadDoc(kind: DocKind, file: File) {
    setUploading(kind);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", kind);
      const res = await fetch("/api/pro-verification/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Envoi du document impossible");
        return;
      }
      if (kind === "identity") {
        setIdPath(data.path);
        setIdName(file.name);
      } else {
        setCompanyPath(data.path);
        setCompanyDocName(file.name);
      }
    } catch {
      setError("Envoi du document impossible");
    } finally {
      setUploading(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName || !idPath || !companyPath) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile/upgrade-pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siret,
          companyName,
          ...biz,
          requestType: "CONVERT_FROM_PRIVATE",
          idDocumentType: idType,
          idDocumentPath: idPath,
          companyDocType,
          companyDocPath: companyPath,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Une erreur est survenue");
      else setSubmitted(true);
    } catch {
      setError("Erreur réseau, réessayez");
    } finally {
      setSaving(false);
    }
  }

  if (infoRequest && !submitted) {
    // Le dossier est ouvert mais incomplet : on montre la demande, et le
    // formulaire reste accessible juste en dessous pour redéposer.
    return (
      <div className="bg-white rounded-2xl p-6 shadow-[0_4px_24px_rgba(21,21,125,0.06)] mb-8">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-amber-600">help</span>
          </div>
          <div>
            <p className="font-bold text-on-surface">Information demandée</p>
            <p className="text-outline text-sm mt-0.5 leading-relaxed">{infoRequest}</p>
            <p className="text-outline text-xs mt-2">
              Répondez à l&apos;email reçu ou redéposez la pièce demandée ci-dessous.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (submitted || pending) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-[0_4px_24px_rgba(21,21,125,0.06)] mb-8 flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-amber-600" style={{ fontVariationSettings: "'FILL' 1" }}>
            hourglass_top
          </span>
        </div>
        <div>
          <p className="font-bold text-on-surface">Dossier en cours d&apos;examen</p>
          <p className="text-outline text-sm mt-0.5 leading-relaxed">
            Un modérateur vérifie vos justificatifs sous 24 à 48&nbsp;heures ouvrées. Vous recevrez
            un email dès que votre compte professionnel sera activé.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-[0_4px_24px_rgba(21,21,125,0.06)] mb-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-[#d5e3fc] flex items-center justify-center">
          <span className="material-symbols-outlined text-[#2f6fb8]">store</span>
        </div>
        <div>
          <h3 className="font-extrabold text-on-surface font-['Manrope']">Passer en compte Pro</h3>
          <p className="text-outline text-xs mt-0.5">Vérification d&apos;identité requise · 24 à 48 h</p>
        </div>
      </div>

      <p className="text-xs text-outline leading-relaxed mb-5 bg-surface-container-low rounded-xl px-4 py-3">
        Un numéro SIRET est public&nbsp;: nous vérifions donc qu&apos;il vous appartient.
        <br />
        <strong>Vos documents ne sont jamais visibles</strong> — ni des autres utilisateurs, ni sur
        votre profil, ni sur vos annonces. Ils sont stockés de façon privée, servent uniquement à la
        modération, et sont <strong>supprimés définitivement dès la validation</strong> de votre
        compte. En cas de refus ou de demande de complément, ils sont conservés le temps de traiter
        le dossier, puis effacés automatiquement au bout de 14&nbsp;mois sans réponse.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-primary tracking-tight mb-1.5">
            NUMÉRO SIRET
          </label>
          <div className="relative">
            <input
              value={siret}
              onChange={(e) => handleSiretChange(e.target.value)}
              type="text"
              inputMode="numeric"
              maxLength={14}
              placeholder="14 chiffres"
              className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary outline-none pr-10"
            />
            {checking && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {companyName && !checking && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="material-symbols-outlined text-green-500 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
            )}
          </div>
        </div>

        {companyName && (
          <div className="bg-[#d5e3fc]/40 border border-[#d5e3fc] rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="material-symbols-outlined text-[#2f6fb8] text-[20px]">store</span>
            <div>
              <p className="text-[10px] font-bold text-[#2f6fb8] uppercase tracking-wider">Entreprise trouvée</p>
              <p className="text-on-surface font-bold text-sm">{companyName}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Text label="Nom commercial (enseigne)" value={biz.commercialName} onChange={(v) => setB("commercialName", v)} placeholder="Barber Turbigo" />
          <Text label="SIREN" value={biz.siren} onChange={(v) => setB("siren", v.replace(/\D/g, "").slice(0, 9))} placeholder="9 chiffres" />
        </div>
        <Text label="Adresse de l'établissement" value={biz.businessAddress} onChange={(v) => setB("businessAddress", v)} placeholder="12 rue de Turbigo, 75003 Paris" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Text label="Activité" value={biz.businessActivity} onChange={(v) => setB("businessActivity", v)} placeholder="Salon de coiffure" />
          <Text label="Catégorie" value={biz.businessCategory} onChange={(v) => setB("businessCategory", v)} placeholder="Beauté & Bien-être" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Text label="Prénom du responsable" value={biz.responsibleFirstName} onChange={(v) => setB("responsibleFirstName", v)} />
          <Text label="Nom du responsable" value={biz.responsibleLastName} onChange={(v) => setB("responsibleLastName", v)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Text label="Téléphone professionnel" value={biz.professionalPhone} onChange={(v) => setB("professionalPhone", v)} />
          <Text label="Email professionnel" value={biz.professionalEmail} onChange={(v) => setB("professionalEmail", v)} />
        </div>

        <DocField
          legend="Pièce d'identité du dirigeant"
          hint="Recto-verso lisible, en cours de validité."
          types={ID_TYPES}
          type={idType}
          onType={setIdType}
          fileName={idName}
          busy={uploading === "identity"}
          inputRef={idInput}
          onFile={(f) => uploadDoc("identity", f)}
        />

        <DocField
          legend="Justificatif d'entreprise"
          hint="Kbis ou avis de situation SIRENE de moins de 3 mois."
          types={COMPANY_DOC_TYPES}
          type={companyDocType}
          onType={setCompanyDocType}
          fileName={companyDocName}
          busy={uploading === "company"}
          inputRef={companyInput}
          onFile={(f) => uploadDoc("company", f)}
        />

        {error && (
          <p className="text-error text-sm font-medium bg-error-container px-4 py-3 rounded-xl">{error}</p>
        )}

        <button
          type="submit"
          disabled={!companyName || !idPath || !companyPath || saving}
          className="w-full bg-gradient-to-r from-primary to-primary-container text-white font-bold py-3 rounded-full shadow-[0_8px_24px_rgba(21,21,125,0.2)] active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">verified_user</span>
          {saving ? "Envoi…" : "Envoyer mon dossier"}
        </button>
      </form>
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-primary tracking-wider uppercase mb-1.5">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-surface-container-low border-none rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-outline/60 focus:ring-2 focus:ring-primary outline-none"
      />
    </div>
  );
}

function DocField({
  legend,
  hint,
  types,
  type,
  onType,
  fileName,
  busy,
  inputRef,
  onFile,
}: {
  legend: string;
  hint: string;
  types: { value: string; label: string }[];
  type: string;
  onType: (v: string) => void;
  fileName: string;
  busy: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
}) {
  return (
    <fieldset>
      <legend className="block text-sm font-bold text-primary tracking-tight mb-1.5 uppercase">
        {legend}
      </legend>
      <select
        value={type}
        onChange={(e) => onType(e.target.value)}
        className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary outline-none mb-2 text-sm"
      >
        {types.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`w-full flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 text-left transition-colors ${
          fileName ? "border-green-300 bg-green-50" : "border-outline-variant/50 hover:border-primary"
        }`}
      >
        <span
          className={`material-symbols-outlined text-[22px] ${fileName ? "text-green-600" : "text-outline"}`}
          style={fileName ? { fontVariationSettings: "'FILL' 1" } : {}}
        >
          {busy ? "hourglass_top" : fileName ? "task_alt" : "upload_file"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-on-surface truncate">
            {busy ? "Envoi en cours…" : fileName || "Choisir un fichier"}
          </span>
          <span className="block text-[11px] text-outline">{hint} JPEG, PNG ou PDF · 8 Mo max.</span>
        </span>
      </button>
    </fieldset>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Documentation API — Deal&Co",
  description: "Intégrez Deal&Co dans votre logiciel. Postez des annonces via notre API REST avec une clé API.",
};

const bodyExample = `{
  "title": "BMW Série 7 730d Automatique",
  "price": 18900,
  "category": "Véhicules",
  "description": "Très bon état général, entretien suivi...",
  "location": "La Ciotat, 13600",
  "condition": "Bon état",
  "phone": "0600000000",
  "vehicle": {
    "marque": "BMW",
    "modele": "Série 7",
    "annee": 2010,
    "kilometrage": 174230,
    "carburant": "Diesel",
    "transmission": "Automatique",
    "couleur": "Gris",
    "puissanceFiscale": 15,
    "motorisation": "730d",
    "nombrePortes": 4,
    "nombrePlaces": 5,
    "emissionCO2": 178,
    "consoMixte": 6.8,
    "critAir": "3",
    "options": [
      "Régulateur de vitesse adaptatif",
      "Radar de stationnement avant",
      "Caméra de recul",
      "Toit ouvrant coulissant/Relevable"
    ]
  }
}`;

const responseExample = `HTTP 201 Created

{
  "ok": true,
  "id": "clxyz1234abcd",
  "url": "https://www.dealandcompany.fr/annonce/clxyz1234abcd",
  "status": "APPROVED",
  "createdAt": "2026-04-15T14:32:00.000Z"
}`;

const curlExample = `curl -X POST \\
  https://www.dealandcompany.fr/api/v1/listings \\
  -H "Authorization: Bearer dc_live_xxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "BMW Série 7 730d",
    "price": 18900,
    "category": "Véhicules",
    "description": "...",
    "location": "La Ciotat, 13600"
  }'`;

const fields = [
  { name: "title",       type: "string",   req: true,  desc: "Titre de l'annonce" },
  { name: "price",       type: "number",   req: true,  desc: "Prix en euros (ex : 18900)" },
  { name: "category",   type: "string",   req: true,  desc: "Véhicules · Immobilier · Mode · Multimédia · Maison · Services · Divers" },
  { name: "description",type: "string",   req: true,  desc: "Description complète de l'annonce" },
  { name: "location",   type: "string",   req: true,  desc: "Ville ou code postal" },
  { name: "condition",  type: "string",   req: false, desc: "Neuf · Très bon état · Bon état · État correct · Pour pièces" },
  { name: "phone",      type: "string",   req: false, desc: "Numéro de téléphone du vendeur" },
  { name: "hidePhone",  type: "boolean",  req: false, desc: "Masquer le téléphone (défaut : false)" },
  { name: "images",     type: "string[]", req: false, desc: "URLs des photos hébergées (max 15)" },
  { name: "subcategory",type: "string",   req: false, desc: "Sous-catégorie si disponible" },
  { name: "vehicle",    type: "object",   req: false, desc: "Bloc données véhicule (voir détail ci-dessous)" },
  { name: "immo",       type: "object",   req: false, desc: "Bloc données immobilier" },
];

const vehicleFields = [
  { name: "marque / modele / annee / kilometrage", desc: "Infos de base" },
  { name: "carburant / transmission / couleur", desc: "Essence · Diesel · Hybride · Électrique / Manuelle · Automatique" },
  { name: "puissanceFiscale / nombrePortes / nombrePlaces", desc: "Chiffres entiers" },
  { name: "motorisation", desc: "Ex : 730d, 2.0 TDI, i4 eDrive40…" },
  { name: "nombreVitesses / typeVehicule / dateImmatriculation", desc: "Infos complémentaires" },
  { name: "critAir", desc: "\"0\" à \"5\" (vignette Crit'Air)" },
  { name: "emissionCO2", desc: "Grammes/km — ex : 178" },
  { name: "consoUrbaine / consoExtraU / consoMixte", desc: "L/100km — ex : 6.8" },
  { name: "options", desc: "string[] — liste des équipements (ABS, GPS, Toit ouvrant…)" },
];

const statusCodes = [
  { code: "201", label: "Annonce créée avec succès",   color: "text-emerald-400 border-emerald-900/50" },
  { code: "400", label: "Champ manquant ou invalide",   color: "text-amber-400 border-amber-900/50" },
  { code: "401", label: "Clé API invalide ou absente",  color: "text-red-400 border-red-900/50" },
  { code: "500", label: "Erreur interne du serveur",    color: "text-slate-400 border-slate-700" },
];

export default function ApiDocPage() {
  return (
    <div className="min-h-screen bg-[#0b0e17] text-white">
      {/* Header */}
      <header className="border-b border-[#1f2937] px-6 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <Link href="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="Deal&Co" className="h-8 w-auto brightness-0 invert" />
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono font-bold bg-[#2f6fb8]/20 text-[#60a5fa] border border-[#2f6fb8]/30 px-2.5 py-1 rounded-full">
            API v1
          </span>
          <Link
            href="/profile#api"
            className="text-xs font-bold bg-[#2f6fb8] text-white px-4 py-2 rounded-full hover:bg-[#1a5a9e] transition-all"
          >
            Obtenir ma clé API
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-14">

        {/* Intro */}
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2f6fb8]">Intégration logiciel</p>
            <h1 className="text-4xl font-extrabold tracking-tight">Documentation API</h1>
          </div>
          <p className="text-[#9ca3af] text-base max-w-2xl leading-relaxed">
            Postez des annonces directement depuis votre DMS, CRM ou logiciel de gestion.
            Notre API REST accepte du JSON et retourne la confirmation immédiate avec l'URL de l'annonce publiée.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm bg-[#141824] border border-[#1f2937] px-3 py-1.5 rounded-lg text-[#60a5fa]">
              Base URL : https://www.dealandcompany.fr
            </span>
            <span className="text-[10px] bg-emerald-900/30 text-emerald-400 border border-emerald-900/50 px-2.5 py-1 rounded-full font-semibold">
              Annonce publiée instantanément
            </span>
          </div>
        </div>

        {/* Authentification */}
        <section className="space-y-5">
          <h2 className="text-xl font-bold border-b border-[#1f2937] pb-3">1. Authentification</h2>
          <div className="bg-[#141824] border border-[#1f2937] rounded-2xl p-6 space-y-4">
            <p className="text-sm text-[#d1d5db] leading-relaxed">
              Chaque requête doit inclure votre clé API dans le header{" "}
              <code className="text-[#60a5fa] font-mono bg-[#0b0e17] px-1.5 py-0.5 rounded">Authorization</code>.
              Générez votre clé depuis{" "}
              <Link href="/profile#api" className="text-[#60a5fa] underline underline-offset-2 font-semibold">
                Mon profil → API
              </Link>{" "}
              (compte Pro requis).
            </p>
            <div className="bg-[#0b0e17] rounded-xl px-4 py-3 font-mono text-sm space-y-1">
              <p>
                <span className="text-[#6b7280]">Authorization: </span>
                <span className="text-[#86efac]">Bearer dc_live_xxxxxxxxxxxxxxxxxxxxxxxx</span>
              </p>
              <p>
                <span className="text-[#6b7280]">Content-Type: </span>
                <span className="text-[#a5b4fc]">application/json</span>
              </p>
            </div>
            <p className="text-[10px] text-[#4b5563]">
              La clé est affichée une seule fois à la génération. En cas de perte, régénérez-en une nouvelle depuis votre profil.
            </p>
          </div>
        </section>

        {/* Endpoint */}
        <section className="space-y-5">
          <h2 className="text-xl font-bold border-b border-[#1f2937] pb-3">2. Créer une annonce</h2>
          <div className="flex items-center gap-3 bg-[#141824] border border-[#1f2937] rounded-xl px-5 py-4">
            <span className="text-[11px] font-black bg-blue-100 text-blue-700 px-2.5 py-1 rounded font-mono shrink-0">POST</span>
            <code className="font-mono text-sm text-white">
              https://www.dealandcompany.fr
              <span className="text-[#60a5fa]">/api/v1/listings</span>
            </code>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-[#6b7280]">Corps de la requête</p>
              <pre className="bg-[#141824] border border-[#1f2937] rounded-2xl p-4 text-xs text-[#a5b4fc] font-mono overflow-x-auto leading-relaxed h-full">
                {bodyExample}
              </pre>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-[#6b7280]">Réponse</p>
                <pre className="bg-[#141824] border border-[#1f2937] rounded-2xl p-4 text-xs text-[#86efac] font-mono overflow-x-auto leading-relaxed">
                  {responseExample}
                </pre>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-[#6b7280]">Exemple cURL</p>
                <pre className="bg-[#141824] border border-[#1f2937] rounded-2xl p-4 text-xs text-[#fcd34d] font-mono overflow-x-auto leading-relaxed">
                  {curlExample}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* Champs */}
        <section className="space-y-5">
          <h2 className="text-xl font-bold border-b border-[#1f2937] pb-3">3. Champs du body</h2>
          <div className="rounded-2xl border border-[#1f2937] overflow-hidden divide-y divide-[#1f2937]">
            <div className="grid grid-cols-12 px-5 py-2 bg-[#0f1117]">
              <span className="col-span-3 text-[9px] font-bold uppercase tracking-widest text-[#4b5563]">Champ</span>
              <span className="col-span-2 text-[9px] font-bold uppercase tracking-widest text-[#4b5563]">Type</span>
              <span className="col-span-1 text-[9px] font-bold uppercase tracking-widest text-[#4b5563]">Req.</span>
              <span className="col-span-6 text-[9px] font-bold uppercase tracking-widest text-[#4b5563]">Description</span>
            </div>
            {fields.map((f) => (
              <div key={f.name} className="grid grid-cols-12 items-start px-5 py-3 hover:bg-[#141824] transition-colors">
                <code className="col-span-3 text-[#60a5fa] font-mono text-xs pt-0.5">{f.name}</code>
                <span className="col-span-2 text-[#6b7280] font-mono text-[10px] pt-0.5">{f.type}</span>
                <span className={`col-span-1 text-[9px] font-bold ${f.req ? "text-red-400" : "text-[#374151]"}`}>
                  {f.req ? "✓" : "—"}
                </span>
                <span className="col-span-6 text-xs text-[#9ca3af]">{f.desc}</span>
              </div>
            ))}
          </div>

          {/* Sous-champs vehicle */}
          <div className="bg-[#141824] border border-[#1f2937] rounded-2xl p-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-[#6b7280]">
              Champs du bloc <code className="text-[#60a5fa]">vehicle</code>
            </p>
            <div className="divide-y divide-[#1f2937]">
              {vehicleFields.map((f) => (
                <div key={f.name} className="flex gap-4 py-2.5">
                  <code className="font-mono text-[11px] text-[#a5b4fc] w-80 shrink-0">{f.name}</code>
                  <span className="text-xs text-[#6b7280]">{f.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Codes réponse */}
        <section className="space-y-5">
          <h2 className="text-xl font-bold border-b border-[#1f2937] pb-3">4. Codes de réponse</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {statusCodes.map(({ code, label, color }) => (
              <div key={code} className={`border rounded-xl px-4 py-4 ${color}`}>
                <p className="font-mono text-2xl font-black">{code}</p>
                <p className="text-[10px] text-[#6b7280] mt-1 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Postman */}
        <section className="space-y-5">
          <h2 className="text-xl font-bold border-b border-[#1f2937] pb-3">5. Tester avec Postman</h2>
          <div className="bg-[#141824] border border-[#1f2937] rounded-2xl p-6 space-y-3">
            {[
              { step: "1", text: "New → HTTP Request → méthode POST" },
              { step: "2", text: "URL : https://www.dealandcompany.fr/api/v1/listings" },
              { step: "3", text: "Headers : Authorization: Bearer dc_live_xxx + Content-Type: application/json" },
              { step: "4", text: "Body → raw → JSON → collez votre annonce" },
              { step: "5", text: "Send → vous recevez 201 Created avec l'URL de l'annonce" },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#2f6fb8]/20 text-[#60a5fa] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {step}
                </span>
                <p className="text-sm text-[#9ca3af]">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[#1f2937] pt-8 flex items-center justify-between flex-wrap gap-4">
          <p className="text-xs text-[#374151]">
            Deal&amp;Co · API v1 · Les annonces sont publiées instantanément
          </p>
          <a
            href="mailto:contact@dealandcompany.fr"
            className="text-xs text-[#2f6fb8] hover:underline font-semibold"
          >
            contact@dealandcompany.fr
          </a>
        </footer>
      </main>
    </div>
  );
}

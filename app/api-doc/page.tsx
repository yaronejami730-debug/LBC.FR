import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Documentation API — Deal&Co",
  description: "Intégrez Deal&Co dans votre logiciel. Postez des annonces immobilières ou automobiles via notre API REST.",
};

// ── Exemples JSON ────────────────────────────────────────────────────────────

const autoExample = `{
  "title": "BMW Série 7 730d Automatique",
  "price": 18900,
  "category": "Véhicules",
  "description": "Très bon état général, entretien suivi...",
  "location": "La Ciotat, 13600",
  "condition": "Bon état",
  "phone": "0600000000",
  "images": [
    "https://exemple.com/photo1.jpg",
    "https://exemple.com/photo2.jpg"
  ],
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
    "nombreVitesses": 6,
    "typeVehicule": "Véhicule de tourisme",
    "dateImmatriculation": "2010-12-27",
    "emissionCO2": 178,
    "consoUrbaine": 9.0,
    "consoExtraU": 5.5,
    "consoMixte": 6.8,
    "critAir": "3",
    "options": [
      "ABS",
      "ESP",
      "Régulateur de vitesse adaptatif",
      "Radar de stationnement avant",
      "Caméra de recul",
      "Toit ouvrant coulissant/Relevable",
      "Siège conducteur chauffant"
    ]
  }
}`;

const immoExample = `{
  "title": "Appartement T3 — Vue mer — Nice Centre",
  "price": 250000,
  "category": "Immobilier",
  "description": "Superbe appartement lumineux avec vue mer...",
  "location": "Nice 06000",
  "condition": "Bon état",
  "phone": "0600000000",
  "images": [
    "https://exemple.com/photo1.jpg",
    "https://exemple.com/photo2.jpg"
  ],
  "immo": {
    "typeBien": "Appartement",
    "surface": 75,
    "nombrePieces": 3,
    "nombreChambres": 2,
    "nombreSallesEau": 1,
    "etage": "3",
    "exposition": "Sud",
    "classeEnergie": "C",
    "ges": "B",
    "typeCharuffe": "Individuel",
    "modeCharuffe": "Électrique",
    "placesParking": 1,
    "anneeConstruction": 1990,
    "etatBien": "Bon état",
    "reference": "REF-2024-001",
    "vueMer": true,
    "visAVis": false,
    "prixHonorairesInclus": 255000,
    "prixHonorairesExclus": 250000,
    "honorairesAcquereur": 5000,
    "taxeFonciere": 1200,
    "caracteristiques": [
      "Balcon",
      "Cave",
      "Gardien",
      "Interphone",
      "Double vitrage",
      "Cuisine équipée"
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

const uploadExample = `// 1. Uploader chaque photo
POST /api/v1/upload
Content-Type: multipart/form-data
Authorization: Bearer dc_live_xxx

→ { "url": "https://xxx.blob.vercel-storage.com/photo.jpg" }

// 2. Créer l'annonce avec les URLs
POST /api/v1/listings
{
  "images": ["https://xxx.blob.vercel-storage.com/photo.jpg"]
}`;

// ── Champs communs ────────────────────────────────────────────────────────────
const commonFields = [
  { name: "title",       type: "string",   req: true,  desc: "Titre de l'annonce" },
  { name: "price",       type: "number",   req: true,  desc: "Prix en euros" },
  { name: "category",    type: "string",   req: true,  desc: "\"Véhicules\" ou \"Immobilier\"" },
  { name: "description", type: "string",   req: true,  desc: "Description complète" },
  { name: "location",    type: "string",   req: true,  desc: "Ville ou code postal" },
  { name: "condition",   type: "string",   req: false, desc: "Neuf · Très bon état · Bon état · État correct · Pour pièces" },
  { name: "phone",       type: "string",   req: false, desc: "Téléphone du vendeur" },
  { name: "hidePhone",   type: "boolean",  req: false, desc: "Masquer le téléphone (défaut : false)" },
  { name: "images",      type: "string[]", req: false, desc: "URLs des photos (max 15) — voir endpoint /api/v1/upload" },
  { name: "vehicle",     type: "object",   req: false, desc: "Bloc automobile — voir ci-dessous" },
  { name: "immo",        type: "object",   req: false, desc: "Bloc immobilier — voir ci-dessous" },
];

const autoFields = [
  { name: "marque",             type: "string",   desc: "Ex : BMW, Renault, Peugeot…" },
  { name: "modele",             type: "string",   desc: "Ex : Série 7, 308, Clio…" },
  { name: "annee",              type: "number",   desc: "Année de mise en circulation" },
  { name: "kilometrage",        type: "number",   desc: "Kilométrage en km" },
  { name: "carburant",          type: "string",   desc: "Essence · Diesel · Hybride · Électrique · GPL" },
  { name: "transmission",       type: "string",   desc: "Manuelle · Automatique" },
  { name: "couleur",            type: "string",   desc: "Ex : Noir, Gris, Blanc…" },
  { name: "puissanceFiscale",   type: "number",   desc: "Chevaux fiscaux (CV)" },
  { name: "motorisation",       type: "string",   desc: "Ex : 730d, 2.0 TDI, i4 eDrive40…" },
  { name: "nombrePortes",       type: "number",   desc: "2, 3, 4 ou 5" },
  { name: "nombrePlaces",       type: "number",   desc: "Nombre de places assises" },
  { name: "nombreVitesses",     type: "number",   desc: "Nombre de rapports de boîte" },
  { name: "typeVehicule",       type: "string",   desc: "Véhicule de tourisme · SUV / 4x4 · Berline · Break · Coupé…" },
  { name: "dateImmatriculation",type: "string",   desc: "Format AAAA-MM-JJ (ex : 2010-12-27)" },
  { name: "emissionCO2",        type: "number",   desc: "Grammes/km (ex : 178)" },
  { name: "consoUrbaine",       type: "number",   desc: "L/100km en ville (ex : 9.0)" },
  { name: "consoExtraU",        type: "number",   desc: "L/100km extra-urbain (ex : 5.5)" },
  { name: "consoMixte",         type: "number",   desc: "L/100km mixte (ex : 6.8)" },
  { name: "critAir",            type: "string",   desc: "Vignette Crit'Air : \"0\" à \"5\"" },
  { name: "options",            type: "string[]", desc: "Liste des équipements (ABS, GPS, Toit ouvrant…)" },
];

const immoFields = [
  { name: "typeBien",            type: "string",  desc: "Appartement · Maison · Villa · Studio · Loft · Terrain · Local commercial…" },
  { name: "surface",             type: "number",  desc: "Surface en m²" },
  { name: "nombrePieces",        type: "number",  desc: "Nombre de pièces total" },
  { name: "nombreChambres",      type: "number",  desc: "Nombre de chambres" },
  { name: "nombreSallesEau",     type: "number",  desc: "Nombre de salles d'eau / bains" },
  { name: "etage",               type: "string",  desc: "Ex : \"3\" ou \"RDC\" ou \"Dernier étage\"" },
  { name: "exposition",          type: "string",  desc: "Ex : Sud, Est, Sud-Ouest…" },
  { name: "classeEnergie",       type: "string",  desc: "DPE : A · B · C · D · E · F · G" },
  { name: "ges",                 type: "string",  desc: "GES : A · B · C · D · E · F · G" },
  { name: "typeCharuffe",        type: "string",  desc: "Central · Individuel · Collectif" },
  { name: "modeCharuffe",        type: "string",  desc: "Gaz · Électrique · Fioul · Pompe à chaleur · Bois" },
  { name: "placesParking",       type: "number",  desc: "Nombre de places de parking" },
  { name: "anneeConstruction",   type: "number",  desc: "Année de construction (ex : 1990)" },
  { name: "etatBien",            type: "string",  desc: "État général du bien" },
  { name: "reference",           type: "string",  desc: "Référence interne agence" },
  { name: "vueMer",              type: "boolean", desc: "true si vue sur mer" },
  { name: "visAVis",             type: "boolean", desc: "true si vis-à-vis" },
  { name: "prixHonorairesInclus",type: "number",  desc: "Prix FAI en euros" },
  { name: "prixHonorairesExclus",type: "number",  desc: "Prix hors honoraires en euros" },
  { name: "honorairesAcquereur", type: "number",  desc: "Honoraires à la charge acquéreur en euros" },
  { name: "taxeFonciere",        type: "number",  desc: "Taxe foncière annuelle en euros" },
  { name: "caracteristiques",    type: "string[]",desc: "Balcon · Terrasse · Jardin · Piscine · Cave · Parking · Ascenseur…" },
];

const statusCodes = [
  { code: "201", label: "Annonce créée",             color: "text-emerald-400 border-emerald-900/50" },
  { code: "400", label: "Champ manquant ou invalide", color: "text-amber-400 border-amber-900/50" },
  { code: "401", label: "Clé API invalide",           color: "text-red-400 border-red-900/50" },
  { code: "500", label: "Erreur serveur",             color: "text-slate-400 border-slate-700" },
];

// ── Composants ────────────────────────────────────────────────────────────────

function FieldTable({ fields }: { fields: { name: string; type: string; desc: string }[] }) {
  return (
    <div className="rounded-xl border border-[#1f2937] overflow-hidden divide-y divide-[#1f2937]">
      <div className="grid grid-cols-12 px-4 py-2 bg-[#0f1117]">
        <span className="col-span-4 text-[9px] font-bold uppercase tracking-widest text-[#4b5563]">Champ</span>
        <span className="col-span-2 text-[9px] font-bold uppercase tracking-widest text-[#4b5563]">Type</span>
        <span className="col-span-6 text-[9px] font-bold uppercase tracking-widest text-[#4b5563]">Description</span>
      </div>
      {fields.map((f) => (
        <div key={f.name} className="grid grid-cols-12 items-start px-4 py-2.5 hover:bg-[#141824] transition-colors">
          <code className="col-span-4 text-[#60a5fa] font-mono text-[11px] pt-0.5">{f.name}</code>
          <span className="col-span-2 text-[#6b7280] font-mono text-[10px] pt-0.5">{f.type}</span>
          <span className="col-span-6 text-xs text-[#9ca3af]">{f.desc}</span>
        </div>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

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

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-16">

        {/* Intro */}
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2f6fb8]">Intégration logiciel</p>
          <h1 className="text-4xl font-extrabold tracking-tight">Documentation API</h1>
          <p className="text-[#9ca3af] text-base max-w-2xl leading-relaxed">
            Postez des annonces <strong className="text-white">automobiles</strong> ou <strong className="text-white">immobilières</strong> directement depuis votre logiciel (DMS, CRM, site de diffusion) via notre API REST.
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

        {/* Auth */}
        <section className="space-y-5">
          <h2 className="text-xl font-bold border-b border-[#1f2937] pb-3">1. Authentification</h2>
          <div className="bg-[#141824] border border-[#1f2937] rounded-2xl p-5 space-y-3">
            <p className="text-sm text-[#d1d5db]">
              Ajoutez votre clé API dans chaque requête via le header <code className="text-[#60a5fa] font-mono bg-[#0b0e17] px-1.5 py-0.5 rounded">Authorization</code>.
              Générez votre clé depuis{" "}
              <Link href="/profile#api" className="text-[#60a5fa] underline underline-offset-2 font-semibold">Mon profil → API</Link>
              {" "}(compte Pro requis).
            </p>
            <div className="bg-[#0b0e17] rounded-xl px-4 py-3 font-mono text-sm space-y-1">
              <p><span className="text-[#6b7280]">Authorization: </span><span className="text-[#86efac]">Bearer dc_live_xxxxxxxxxxxxxxxxxxxxxxxx</span></p>
              <p><span className="text-[#6b7280]">Content-Type: </span><span className="text-[#a5b4fc]">application/json</span></p>
            </div>
          </div>
        </section>

        {/* Endpoint */}
        <section className="space-y-5">
          <h2 className="text-xl font-bold border-b border-[#1f2937] pb-3">2. Endpoint</h2>
          <div className="flex items-center gap-3 bg-[#141824] border border-[#1f2937] rounded-xl px-5 py-4">
            <span className="text-[11px] font-black bg-blue-100 text-blue-700 px-2.5 py-1 rounded font-mono shrink-0">POST</span>
            <code className="font-mono text-sm text-white">
              https://www.dealandcompany.fr<span className="text-[#60a5fa]">/api/v1/listings</span>
            </code>
          </div>

          {/* Réponse */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-[#6b7280]">Réponse succès</p>
              <pre className="bg-[#141824] border border-[#1f2937] rounded-2xl p-4 text-xs text-[#86efac] font-mono overflow-x-auto leading-relaxed">
                {responseExample}
              </pre>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-[#6b7280]">Codes de réponse</p>
              <div className="grid grid-cols-2 gap-2">
                {statusCodes.map(({ code, label, color }) => (
                  <div key={code} className={`border rounded-xl px-3 py-3 ${color}`}>
                    <p className="font-mono text-xl font-black">{code}</p>
                    <p className="text-[10px] text-[#6b7280] mt-0.5 leading-tight">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Champs communs */}
        <section className="space-y-5">
          <h2 className="text-xl font-bold border-b border-[#1f2937] pb-3">3. Champs communs</h2>
          <p className="text-sm text-[#9ca3af]">Ces champs s'appliquent à toutes les annonces (automobile et immobilier).</p>
          <FieldTable fields={commonFields} />
        </section>

        {/* ── BLOC AUTOMOBILE ─────────────────────────────────────────────── */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-[#1f2937] pb-3">
            <span className="w-8 h-8 rounded-lg bg-blue-900/40 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[#60a5fa] text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>directions_car</span>
            </span>
            <h2 className="text-xl font-bold">4. Bloc Automobile</h2>
          </div>

          <p className="text-sm text-[#9ca3af]">
            Utilisez <code className="text-[#60a5fa] font-mono bg-[#141824] px-1.5 py-0.5 rounded">category: "Véhicules"</code> et remplissez le champ <code className="text-[#60a5fa] font-mono bg-[#141824] px-1.5 py-0.5 rounded">vehicle</code>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-[#6b7280]">Exemple complet</p>
              <pre className="bg-[#141824] border border-[#1f2937] rounded-2xl p-4 text-xs text-[#a5b4fc] font-mono overflow-x-auto leading-relaxed h-full">
                {autoExample}
              </pre>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-[#6b7280]">Champs du bloc vehicle</p>
              <FieldTable fields={autoFields} />
            </div>
          </div>
        </section>

        {/* ── BLOC IMMOBILIER ─────────────────────────────────────────────── */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-b border-[#1f2937] pb-3">
            <span className="w-8 h-8 rounded-lg bg-emerald-900/40 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-emerald-400 text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>home</span>
            </span>
            <h2 className="text-xl font-bold">5. Bloc Immobilier</h2>
          </div>

          <p className="text-sm text-[#9ca3af]">
            Utilisez <code className="text-[#60a5fa] font-mono bg-[#141824] px-1.5 py-0.5 rounded">category: "Immobilier"</code> et remplissez le champ <code className="text-[#60a5fa] font-mono bg-[#141824] px-1.5 py-0.5 rounded">immo</code>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-[#6b7280]">Exemple complet</p>
              <pre className="bg-[#141824] border border-[#1f2937] rounded-2xl p-4 text-xs text-[#86efac] font-mono overflow-x-auto leading-relaxed h-full">
                {immoExample}
              </pre>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-[#6b7280]">Champs du bloc immo</p>
              <FieldTable fields={immoFields} />
            </div>
          </div>
        </section>

        {/* Photos */}
        <section className="space-y-5">
          <h2 className="text-xl font-bold border-b border-[#1f2937] pb-3">6. Upload de photos</h2>
          <p className="text-sm text-[#9ca3af]">
            Uploadez chaque photo d'abord, récupérez l'URL, puis passez les URLs dans le champ <code className="text-[#60a5fa] font-mono bg-[#141824] px-1.5 py-0.5 rounded">images</code> de l'annonce. Max 15 photos, 10 Mo par photo.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-[#6b7280]">Endpoint upload</p>
              <div className="flex items-center gap-3 bg-[#141824] border border-[#1f2937] rounded-xl px-4 py-3">
                <span className="text-[11px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-mono shrink-0">POST</span>
                <code className="font-mono text-xs text-[#60a5fa]">/api/v1/upload</code>
              </div>
              <p className="text-[10px] text-[#6b7280]">Body : <code className="font-mono">multipart/form-data</code> avec le champ <code className="font-mono text-[#60a5fa]">file</code></p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-[#6b7280]">Exemple</p>
              <pre className="bg-[#141824] border border-[#1f2937] rounded-2xl p-4 text-xs text-[#fcd34d] font-mono overflow-x-auto leading-relaxed">
                {uploadExample}
              </pre>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[#1f2937] pt-8 flex items-center justify-between flex-wrap gap-4">
          <p className="text-xs text-[#374151]">Deal&amp;Co · API v1 · Annonces publiées instantanément</p>
          <a href="mailto:contact@dealandcompany.fr" className="text-xs text-[#2f6fb8] hover:underline font-semibold">
            contact@dealandcompany.fr
          </a>
        </footer>
      </main>
    </div>
  );
}

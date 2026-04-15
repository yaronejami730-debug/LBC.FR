import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Documentation API — Deal&Co",
  description:
    "Documentation complète de l'API Deal&Co. Publiez des annonces automobiles et immobilières depuis votre logiciel via notre API REST.",
};

// ── Code examples ─────────────────────────────────────────────────────────────

const CODE = {
  auth: `Authorization: Bearer dc_live_xxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json`,

  curl: `curl -X POST https://www.dealandcompany.fr/api/v1/listings \\
  -H "Authorization: Bearer dc_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"BMW 320d","price":15900,"category":"Véhicules","description":"...","location":"Paris 75001"}'`,

  response: `{
  "ok": true,
  "id": "clxyz1234abcd",
  "url": "https://www.dealandcompany.fr/annonce/clxyz1234abcd",
  "status": "APPROVED",
  "createdAt": "2026-04-15T14:32:00.000Z"
}`,

  error401: `{
  "error": "Clé API invalide ou manquante."
}`,

  error400: `{
  "error": "Champs requis manquants : title, price, category, description, location"
}`,

  auto: `{
  "title": "BMW Série 7 730d Automatique",
  "price": 18900,
  "category": "Véhicules",
  "description": "Très bon état général, entretien suivi, carnet à jour. Disponible immédiatement.",
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
      "ABS", "ESP", "Régulateur de vitesse adaptatif",
      "Radar de stationnement avant", "Caméra de recul",
      "Toit ouvrant coulissant/Relevable", "Siège conducteur chauffant"
    ]
  }
}`,

  immo: `{
  "title": "Appartement T3 — Vue mer — Nice Centre",
  "price": 250000,
  "category": "Immobilier",
  "description": "Superbe appartement lumineux avec vue mer panoramique, entièrement rénové.",
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
      "Balcon", "Cave", "Gardien", "Double vitrage", "Cuisine équipée"
    ]
  }
}`,

  upload: `# Étape 1 — Uploader la photo
curl -X POST https://www.dealandcompany.fr/api/v1/upload \\
  -H "Authorization: Bearer dc_live_xxx" \\
  -F "file=@/chemin/vers/photo.jpg"

# Réponse
{ "url": "https://xxx.blob.vercel-storage.com/uploads/photo.jpg" }

# Étape 2 — Utiliser l'URL dans l'annonce
{
  "title": "...",
  "images": ["https://xxx.blob.vercel-storage.com/uploads/photo.jpg"]
}`,
};

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV = [
  { id: "intro",         label: "Introduction" },
  { id: "auth",          label: "Authentification" },
  { id: "quickstart",    label: "Démarrage rapide" },
  { id: "auto",          label: "🚗  Automobile" },
  { id: "immo",          label: "🏠  Immobilier" },
  { id: "photos",        label: "Photos" },
  { id: "errors",        label: "Codes d'erreur" },
];

// ── Field row ─────────────────────────────────────────────────────────────────

function Field({ name, type, req, desc }: { name: string; type: string; req?: boolean; desc: string }) {
  return (
    <div className="flex gap-4 py-3 border-b border-white/5 last:border-0">
      <div className="w-52 shrink-0">
        <code className="text-[#93c5fd] font-mono text-sm">{name}</code>
        {req && <span className="ml-2 text-[9px] font-bold text-red-400 uppercase">requis</span>}
      </div>
      <div className="w-24 shrink-0">
        <span className="text-[#6b7280] font-mono text-xs">{type}</span>
      </div>
      <p className="text-[#94a3b8] text-sm flex-1">{desc}</p>
    </div>
  );
}

function CodeBlock({ code, label, color = "text-[#a5b4fc]" }: { code: string; label?: string; color?: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10">
      {label && (
        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border-b border-white/10">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
          </div>
          <span className="text-[10px] text-[#6b7280] font-mono ml-1">{label}</span>
        </div>
      )}
      <pre className={`p-5 text-xs font-mono leading-relaxed overflow-x-auto bg-[#0d1117] ${color}`}>
        {code}
      </pre>
    </div>
  );
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-2xl font-bold text-white scroll-mt-8 mb-6 flex items-center gap-3">
      {children}
    </h2>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-bold text-white mb-3">{children}</h3>;
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-[#1e3a5f]/40 border border-[#2f6fb8]/30 rounded-xl px-4 py-3 text-sm text-[#93c5fd]">
      <span className="shrink-0 mt-0.5">ℹ️</span>
      <p>{children}</p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ApiDocPage() {
  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3] font-sans">

      {/* Top bar */}
      <header className="fixed top-0 w-full z-50 bg-[#0d1117]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/">
              <img src="/logo.png" alt="Deal&Co" className="h-7 w-auto brightness-0 invert opacity-90" />
            </Link>
            <span className="text-[#30363d] select-none">/</span>
            <span className="text-sm font-semibold text-[#e6edf3]">Documentation API</span>
            <span className="text-[10px] font-bold bg-[#2f6fb8]/20 text-[#60a5fa] border border-[#2f6fb8]/30 px-2 py-0.5 rounded-full">
              v1
            </span>
          </div>
          <Link
            href="/profile#api"
            className="text-xs font-bold bg-[#238636] text-white px-4 py-1.5 rounded-lg hover:bg-[#2ea043] transition-colors"
          >
            Obtenir une clé API
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex pt-14">

        {/* Sidebar */}
        <aside className="hidden lg:block w-60 shrink-0 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto py-8 pr-4">
          <nav className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#6b7280] px-3 mb-3">Référence</p>
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block px-3 py-1.5 text-sm text-[#8b949e] hover:text-[#e6edf3] hover:bg-white/5 rounded-lg transition-colors"
              >
                {item.label}
              </a>
            ))}
            <div className="border-t border-white/10 my-4" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#6b7280] px-3 mb-3">Endpoints</p>
            {[
              { method: "POST", path: "/api/v1/listings" },
              { method: "POST", path: "/api/v1/upload" },
            ].map((e) => (
              <div key={e.path} className="flex items-center gap-2 px-3 py-1.5">
                <span className="text-[9px] font-black text-blue-400 w-8 shrink-0">{e.method}</span>
                <code className="text-xs text-[#6b7280] truncate">{e.path}</code>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 py-12 px-6 lg:px-12 max-w-4xl space-y-20">

          {/* ── Introduction ── */}
          <section id="intro">
            <SectionTitle id="intro">Introduction</SectionTitle>
            <div className="space-y-4 text-[#8b949e] leading-relaxed">
              <p>
                L'API Deal&Co vous permet de publier des annonces <strong className="text-[#e6edf3]">automobiles</strong> et <strong className="text-[#e6edf3]">immobilières</strong> directement depuis votre logiciel de gestion, site de diffusion, ou outil d'automatisation (Make, Zapier, n8n…).
              </p>
              <p>
                Chaque annonce soumise via l'API est <strong className="text-[#e6edf3]">publiée immédiatement</strong> sur dealandcompany.fr, visible par tous les visiteurs, au nom de votre compte professionnel.
              </p>
              <p>
                L'API utilise le protocole <strong className="text-[#e6edf3]">HTTPS</strong>, accepte et retourne du <strong className="text-[#e6edf3]">JSON</strong>, et s'authentifie via une <strong className="text-[#e6edf3]">clé API Bearer</strong>.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {[
                  { icon: "🔒", title: "Sécurisé", desc: "HTTPS + clé API par compte" },
                  { icon: "⚡", title: "Instantané", desc: "Annonce en ligne dès la requête" },
                  { icon: "🏢", title: "Pro", desc: "Réservé aux comptes professionnels" },
                ].map((f) => (
                  <div key={f.title} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-xl mb-1">{f.icon}</p>
                    <p className="text-sm font-bold text-[#e6edf3]">{f.title}</p>
                    <p className="text-xs text-[#6b7280] mt-0.5">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Authentification ── */}
          <section id="auth">
            <SectionTitle id="auth">Authentification</SectionTitle>
            <div className="space-y-5 text-[#8b949e]">
              <p>
                Toutes les requêtes API doivent inclure votre clé dans le header <code className="text-[#93c5fd] bg-white/10 px-1.5 py-0.5 rounded text-sm font-mono">Authorization</code>.
              </p>
              <div className="space-y-3">
                <SubTitle>Obtenir une clé</SubTitle>
                <ol className="space-y-2 text-sm">
                  <li className="flex gap-3"><span className="w-5 h-5 rounded-full bg-[#2f6fb8] text-white text-xs flex items-center justify-center shrink-0 font-bold mt-0.5">1</span><span>Connectez-vous avec un compte <strong className="text-[#e6edf3]">professionnel</strong></span></li>
                  <li className="flex gap-3"><span className="w-5 h-5 rounded-full bg-[#2f6fb8] text-white text-xs flex items-center justify-center shrink-0 font-bold mt-0.5">2</span><span>Accédez à <Link href="/profile#api" className="text-[#60a5fa] hover:underline">Mon profil → API</Link></span></li>
                  <li className="flex gap-3"><span className="w-5 h-5 rounded-full bg-[#2f6fb8] text-white text-xs flex items-center justify-center shrink-0 font-bold mt-0.5">3</span><span>Cliquez sur <strong className="text-[#e6edf3]">"Générer ma clé API"</strong></span></li>
                  <li className="flex gap-3"><span className="w-5 h-5 rounded-full bg-[#2f6fb8] text-white text-xs flex items-center justify-center shrink-0 font-bold mt-0.5">4</span><span>Copiez la clé — elle n'est affichée <strong className="text-[#e6edf3]">qu'une seule fois</strong></span></li>
                </ol>
              </div>
              <CodeBlock label="Headers requis" code={CODE.auth} color="text-[#86efac]" />
              <Note>
                Votre clé commence toujours par <code className="font-mono">dc_live_</code>. Ne la partagez pas — elle donne accès à votre compte.
              </Note>
            </div>
          </section>

          {/* ── Quickstart ── */}
          <section id="quickstart">
            <SectionTitle id="quickstart">Démarrage rapide</SectionTitle>
            <div className="space-y-5 text-[#8b949e]">
              <p>Voici la requête minimale pour publier une annonce en 30 secondes.</p>
              <CodeBlock label="cURL — annonce minimale" code={CODE.curl} color="text-[#fcd34d]" />
              <SubTitle>Réponse</SubTitle>
              <CodeBlock label="201 Created" code={CODE.response} color="text-[#86efac]" />
              <p className="text-sm">
                Le champ <code className="text-[#93c5fd] bg-white/10 px-1.5 py-0.5 rounded font-mono">url</code> contient le lien direct vers l'annonce publiée sur le site.
              </p>
            </div>
          </section>

          {/* ── Automobile ── */}
          <section id="auto">
            <SectionTitle id="auto">
              <span className="w-9 h-9 rounded-lg bg-blue-900/50 border border-blue-800/50 flex items-center justify-center text-lg shrink-0">🚗</span>
              Automobile
            </SectionTitle>
            <div className="space-y-6 text-[#8b949e]">
              <p>
                Pour une annonce automobile, utilisez <code className="text-[#93c5fd] bg-white/10 px-1.5 py-0.5 rounded font-mono text-sm">"category": "Véhicules"</code> et renseignez le bloc <code className="text-[#93c5fd] bg-white/10 px-1.5 py-0.5 rounded font-mono text-sm">vehicle</code> avec les caractéristiques du véhicule.
              </p>

              <CodeBlock label="Exemple complet — Véhicule" code={CODE.auto} color="text-[#a5b4fc]" />

              <div>
                <SubTitle>Champs du bloc vehicle</SubTitle>
                <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-12 px-4 py-2 bg-white/5 border-b border-white/10">
                    <span className="col-span-5 text-[10px] font-bold uppercase tracking-widest text-[#6b7280]">Champ</span>
                    <span className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-[#6b7280]">Type</span>
                    <span className="col-span-5 text-[10px] font-bold uppercase tracking-widest text-[#6b7280]">Description</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {[
                      ["marque",              "string",   "Ex : BMW, Renault, Peugeot…"],
                      ["modele",              "string",   "Ex : Série 7, 308, Clio…"],
                      ["annee",               "number",   "Année de mise en circulation"],
                      ["kilometrage",         "number",   "Kilométrage en km"],
                      ["carburant",           "string",   "Essence · Diesel · Hybride · Électrique · GPL"],
                      ["transmission",        "string",   "Manuelle · Automatique"],
                      ["couleur",             "string",   "Ex : Noir, Gris, Blanc…"],
                      ["puissanceFiscale",    "number",   "Chevaux fiscaux (CV)"],
                      ["motorisation",        "string",   "Ex : 730d, 2.0 TDI, i4 eDrive40…"],
                      ["nombrePortes",        "number",   "2, 3, 4 ou 5"],
                      ["nombrePlaces",        "number",   "Nombre de places assises"],
                      ["nombreVitesses",      "number",   "Nombre de rapports de boîte"],
                      ["typeVehicule",        "string",   "Véhicule de tourisme · SUV · Berline · Break · Coupé · Cabriolet…"],
                      ["dateImmatriculation", "string",   "Format AAAA-MM-JJ (ex : 2010-12-27)"],
                      ["emissionCO2",         "number",   "Grammes/km (ex : 178)"],
                      ["consoUrbaine",        "number",   "L/100km en ville"],
                      ["consoExtraU",         "number",   "L/100km extra-urbain"],
                      ["consoMixte",          "number",   "L/100km mixte"],
                      ["critAir",             "string",   "Vignette Crit'Air : \"0\" (électrique) à \"5\""],
                      ["options",             "string[]", "Liste des équipements : [\"ABS\", \"GPS\", \"Toit ouvrant\"…]"],
                    ].map(([name, type, desc]) => (
                      <div key={name} className="grid grid-cols-12 items-start px-4 py-2.5 hover:bg-white/3 transition-colors">
                        <code className="col-span-5 text-[#93c5fd] font-mono text-xs">{name}</code>
                        <span className="col-span-2 text-[#6b7280] font-mono text-[10px]">{type}</span>
                        <span className="col-span-5 text-xs text-[#6b7280]">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Immobilier ── */}
          <section id="immo">
            <SectionTitle id="immo">
              <span className="w-9 h-9 rounded-lg bg-emerald-900/50 border border-emerald-800/50 flex items-center justify-center text-lg shrink-0">🏠</span>
              Immobilier
            </SectionTitle>
            <div className="space-y-6 text-[#8b949e]">
              <p>
                Pour une annonce immobilière, utilisez <code className="text-[#93c5fd] bg-white/10 px-1.5 py-0.5 rounded font-mono text-sm">"category": "Immobilier"</code> et renseignez le bloc <code className="text-[#93c5fd] bg-white/10 px-1.5 py-0.5 rounded font-mono text-sm">immo</code>.
              </p>

              <CodeBlock label="Exemple complet — Bien immobilier" code={CODE.immo} color="text-[#86efac]" />

              <div>
                <SubTitle>Champs du bloc immo</SubTitle>
                <div className="bg-[#161b22] border border-white/10 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-12 px-4 py-2 bg-white/5 border-b border-white/10">
                    <span className="col-span-5 text-[10px] font-bold uppercase tracking-widest text-[#6b7280]">Champ</span>
                    <span className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-[#6b7280]">Type</span>
                    <span className="col-span-5 text-[10px] font-bold uppercase tracking-widest text-[#6b7280]">Description</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {[
                      ["typeBien",             "string",   "Appartement · Maison · Villa · Studio · Loft · Terrain · Local commercial · Bureau · Garage"],
                      ["surface",              "number",   "Surface en m²"],
                      ["nombrePieces",         "number",   "Nombre de pièces total"],
                      ["nombreChambres",       "number",   "Nombre de chambres"],
                      ["nombreSallesEau",      "number",   "Nombre de salles d'eau / bains"],
                      ["etage",                "string",   "Ex : \"3\", \"RDC\", \"Dernier étage\""],
                      ["exposition",           "string",   "Ex : Sud, Est, Sud-Ouest…"],
                      ["classeEnergie",        "string",   "DPE : A · B · C · D · E · F · G"],
                      ["ges",                  "string",   "GES : A · B · C · D · E · F · G"],
                      ["typeCharuffe",         "string",   "Central · Individuel · Collectif"],
                      ["modeCharuffe",         "string",   "Gaz · Électrique · Fioul · Pompe à chaleur · Bois"],
                      ["placesParking",        "number",   "Nombre de places de parking"],
                      ["anneeConstruction",    "number",   "Année de construction (ex : 1990)"],
                      ["etatBien",             "string",   "État général du bien"],
                      ["reference",            "string",   "Référence interne agence"],
                      ["vueMer",               "boolean",  "true si vue sur mer"],
                      ["visAVis",              "boolean",  "true si vis-à-vis"],
                      ["prixHonorairesInclus", "number",   "Prix FAI en euros"],
                      ["prixHonorairesExclus", "number",   "Prix hors honoraires en euros"],
                      ["honorairesAcquereur",  "number",   "Honoraires à la charge acquéreur en euros"],
                      ["taxeFonciere",         "number",   "Taxe foncière annuelle en euros"],
                      ["caracteristiques",     "string[]", "Balcon · Terrasse · Jardin · Piscine · Cave · Parking · Ascenseur · Double vitrage…"],
                    ].map(([name, type, desc]) => (
                      <div key={name} className="grid grid-cols-12 items-start px-4 py-2.5 hover:bg-white/3 transition-colors">
                        <code className="col-span-5 text-[#93c5fd] font-mono text-xs">{name}</code>
                        <span className="col-span-2 text-[#6b7280] font-mono text-[10px]">{type}</span>
                        <span className="col-span-5 text-xs text-[#6b7280]">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Photos ── */}
          <section id="photos">
            <SectionTitle id="photos">Photos</SectionTitle>
            <div className="space-y-5 text-[#8b949e]">
              <p>
                Les photos sont uploadées séparément via <code className="text-[#93c5fd] bg-white/10 px-1.5 py-0.5 rounded font-mono text-sm">POST /api/v1/upload</code>, puis les URLs retournées sont passées dans le champ <code className="text-[#93c5fd] bg-white/10 px-1.5 py-0.5 rounded font-mono text-sm">images</code> de l'annonce.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: "Format", value: "multipart/form-data" },
                  { label: "Champ", value: "file" },
                  { label: "Taille max", value: "10 Mo par photo" },
                  { label: "Types acceptés", value: "JPEG, PNG, WebP, GIF" },
                  { label: "Nombre max", value: "15 photos par annonce" },
                  { label: "Stockage", value: "Vercel Blob (CDN mondial)" },
                ].map((f) => (
                  <div key={f.label} className="bg-[#161b22] border border-white/10 rounded-xl px-4 py-3">
                    <p className="text-[10px] text-[#6b7280] uppercase font-bold tracking-widest">{f.label}</p>
                    <p className="text-sm text-[#e6edf3] font-mono mt-0.5">{f.value}</p>
                  </div>
                ))}
              </div>
              <CodeBlock label="Workflow upload + annonce" code={CODE.upload} color="text-[#fcd34d]" />
              <Note>
                La première URL dans le tableau <code className="font-mono">images</code> est utilisée comme photo principale de l'annonce.
              </Note>
            </div>
          </section>

          {/* ── Errors ── */}
          <section id="errors">
            <SectionTitle id="errors">Codes d'erreur</SectionTitle>
            <div className="space-y-6 text-[#8b949e]">
              <p>L'API retourne du JSON pour toutes les réponses, y compris les erreurs.</p>
              <div className="space-y-4">
                {[
                  {
                    code: "201", label: "Created", color: "text-emerald-400 border-emerald-800/50 bg-emerald-900/20",
                    desc: "L'annonce a été créée avec succès.", example: CODE.response, exColor: "text-[#86efac]",
                  },
                  {
                    code: "400", label: "Bad Request", color: "text-amber-400 border-amber-800/50 bg-amber-900/20",
                    desc: "Un champ requis est manquant ou invalide (title, price, category, description, location).", example: CODE.error400, exColor: "text-[#fcd34d]",
                  },
                  {
                    code: "401", label: "Unauthorized", color: "text-red-400 border-red-800/50 bg-red-900/20",
                    desc: "Clé API absente, invalide ou révoquée.", example: CODE.error401, exColor: "text-red-400",
                  },
                  {
                    code: "500", label: "Server Error", color: "text-[#6b7280] border-[#30363d] bg-white/5",
                    desc: "Erreur interne. Réessayez dans quelques secondes.", example: `{ "error": "Erreur interne du serveur" }`, exColor: "text-[#6b7280]",
                  },
                ].map((e) => (
                  <div key={e.code} className={`border rounded-2xl overflow-hidden ${e.color}`}>
                    <div className="px-5 py-3 flex items-center gap-3">
                      <span className={`font-mono text-2xl font-black ${e.color.split(" ")[0]}`}>{e.code}</span>
                      <span className="font-bold text-sm text-[#e6edf3]">{e.label}</span>
                    </div>
                    <div className="border-t border-white/10 px-5 py-3 space-y-3 bg-[#0d1117]">
                      <p className="text-sm">{e.desc}</p>
                      <pre className={`text-xs font-mono ${e.exColor}`}>{e.example}</pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-white/10 pt-10 pb-4 flex items-center justify-between flex-wrap gap-4">
            <p className="text-xs text-[#6b7280]">
              Deal&amp;Co · API v1 · Les annonces sont publiées instantanément ·{" "}
              <a href="mailto:contact@dealandcompany.fr" className="text-[#60a5fa] hover:underline">
                contact@dealandcompany.fr
              </a>
            </p>
            <Link href="/" className="text-xs text-[#6b7280] hover:text-[#e6edf3] transition-colors">
              ← Retour au site
            </Link>
          </footer>

        </main>
      </div>
    </div>
  );
}

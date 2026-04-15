export default function ApiDocSection() {
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
    { name: "title", type: "string", req: true, desc: "Titre de l'annonce" },
    { name: "price", type: "number", req: true, desc: "Prix en euros (ex : 18900)" },
    { name: "category", type: "string", req: true, desc: "Véhicules · Immobilier · Mode · Multimédia · Maison · Services · Divers" },
    { name: "description", type: "string", req: true, desc: "Description complète de l'annonce" },
    { name: "location", type: "string", req: true, desc: "Ville ou code postal" },
    { name: "condition", type: "string", req: false, desc: "Neuf · Très bon état · Bon état · État correct · Pour pièces" },
    { name: "phone", type: "string", req: false, desc: "Numéro de téléphone du vendeur" },
    { name: "hidePhone", type: "boolean", req: false, desc: "Masquer le téléphone (défaut : false)" },
    { name: "images", type: "string[]", req: false, desc: "URLs des photos (max 15)" },
    { name: "subcategory", type: "string", req: false, desc: "Sous-catégorie si disponible" },
    { name: "vehicle", type: "object", req: false, desc: "Bloc données véhicule (voir détail ci-dessous)" },
    { name: "immo", type: "object", req: false, desc: "Bloc données immobilier" },
  ];

  const vehicleFields = [
    "marque · modele · annee · kilometrage · carburant · transmission · couleur",
    "immatriculation · puissanceFiscale · nombrePortes · nombrePlaces",
    "motorisation · nombreVitesses · typeVehicule · dateImmatriculation",
    "critAir · emissionCO2 · consoUrbaine · consoExtraU · consoMixte",
    "options: string[]  // tableau des équipements",
  ];

  return (
    <section className="bg-[#0b0e17] text-white py-16 px-4">
      <div className="max-w-5xl mx-auto space-y-12">

        {/* Header */}
        <div className="space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2f6fb8]">
            Intégration logiciel
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight">Documentation API</h2>
          <p className="text-[#9ca3af] text-sm max-w-xl leading-relaxed">
            Postez des annonces directement depuis votre logiciel (DMS, CRM, outil de gestion) via notre API REST. Une clé API suffit — disponible depuis votre profil.
          </p>
        </div>

        {/* Authentification */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#6b7280]">
            1. Authentification
          </h3>
          <div className="bg-[#141824] border border-[#1f2937] rounded-2xl p-5 space-y-3">
            <p className="text-sm text-[#d1d5db]">
              Générez votre clé API depuis{" "}
              <span className="text-[#60a5fa] font-semibold">Mon profil → Clé API</span>.
              La clé est affichée <strong>une seule fois</strong> — conservez-la précieusement.
            </p>
            <div className="bg-[#0b0e17] rounded-xl px-4 py-3 font-mono text-sm">
              <span className="text-[#6b7280]">Authorization: </span>
              <span className="text-[#86efac]">Bearer dc_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</span>
            </div>
            <p className="text-[10px] text-[#4b5563]">
              Chaque clé est liée à votre compte. L'annonce est postée en votre nom (société affichée si compte Pro).
            </p>
          </div>
        </div>

        {/* Endpoint */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#6b7280]">
            2. Endpoint
          </h3>
          <div className="flex items-center gap-3 bg-[#141824] border border-[#1f2937] rounded-2xl px-5 py-4">
            <span className="text-[11px] font-black bg-blue-100 text-blue-700 px-2.5 py-1 rounded font-mono shrink-0">
              POST
            </span>
            <span className="font-mono text-sm text-white">
              https://www.dealandcompany.fr
              <span className="text-[#60a5fa]">/api/v1/listings</span>
            </span>
          </div>
        </div>

        {/* Corps + Réponse */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#6b7280]">
              Corps de la requête (JSON)
            </h3>
            <pre className="bg-[#141824] border border-[#1f2937] rounded-2xl p-4 text-xs text-[#a5b4fc] font-mono overflow-x-auto leading-relaxed">
              {bodyExample}
            </pre>
          </div>
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#6b7280]">
              Réponse
            </h3>
            <pre className="bg-[#141824] border border-[#1f2937] rounded-2xl p-4 text-xs text-[#86efac] font-mono overflow-x-auto leading-relaxed">
              {responseExample}
            </pre>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#6b7280] pt-2">
              Exemple cURL
            </h3>
            <pre className="bg-[#141824] border border-[#1f2937] rounded-2xl p-4 text-xs text-[#fcd34d] font-mono overflow-x-auto leading-relaxed">
              {curlExample}
            </pre>
          </div>
        </div>

        {/* Champs */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#6b7280]">
            3. Champs disponibles
          </h3>
          <div className="rounded-2xl border border-[#1f2937] overflow-hidden divide-y divide-[#1f2937]">
            {fields.map((f) => (
              <div key={f.name} className="flex items-start gap-4 px-5 py-3 hover:bg-[#141824] transition-colors">
                <code className="text-[#60a5fa] font-mono text-xs w-28 shrink-0 pt-0.5">{f.name}</code>
                <span className="text-[10px] text-[#6b7280] font-mono w-16 shrink-0 pt-0.5">{f.type}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${f.req ? "bg-red-900/40 text-red-400" : "bg-[#1f2937] text-[#6b7280]"}`}>
                  {f.req ? "requis" : "optionnel"}
                </span>
                <span className="text-xs text-[#9ca3af]">{f.desc}</span>
              </div>
            ))}
          </div>

          {/* Sous-champs vehicle */}
          <div className="bg-[#141824] border border-[#1f2937] rounded-2xl p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#6b7280] mb-3">
              Champs du bloc <code className="text-[#60a5fa]">vehicle</code>
            </p>
            {vehicleFields.map((line) => (
              <p key={line} className="font-mono text-[11px] text-[#9ca3af]">{line}</p>
            ))}
          </div>
        </div>

        {/* Codes erreur */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#6b7280]">
            4. Codes de réponse
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { code: "201", label: "Annonce créée", color: "text-emerald-400 border-emerald-900" },
              { code: "400", label: "Champ manquant ou invalide", color: "text-amber-400 border-amber-900" },
              { code: "401", label: "Clé API invalide", color: "text-red-400 border-red-900" },
              { code: "500", label: "Erreur serveur interne", color: "text-[#6b7280] border-[#1f2937]" },
            ].map(({ code, label, color }) => (
              <div key={code} className={`border rounded-xl px-4 py-3 ${color}`}>
                <p className="font-mono text-lg font-black">{code}</p>
                <p className="text-[10px] text-[#6b7280] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-[#374151] text-center pt-4 border-t border-[#1f2937]">
          Deal&amp;Co · API v1 · Les annonces postées via API sont immédiatement en ligne ·{" "}
          <a href="mailto:contact@dealandcompany.fr" className="text-[#2f6fb8] hover:underline">
            contact@dealandcompany.fr
          </a>
        </p>
      </div>
    </section>
  );
}

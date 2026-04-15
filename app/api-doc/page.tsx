import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "API — Deal&Co",
  description:
    "Publiez des annonces automobiles et immobilières depuis votre logiciel via l'API REST Deal&Co.",
};

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

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 bg-[#f8f9fb]">
      {label && (
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200">
          <span className="text-[11px] font-mono text-slate-500">{label}</span>
        </div>
      )}
      <pre className="p-4 text-xs font-mono leading-relaxed overflow-x-auto text-[#2f6fb8]">
        {code}
      </pre>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm text-slate-600">
      <span className="w-6 h-6 rounded-full bg-[#2f6fb8] text-white text-xs flex items-center justify-center shrink-0 font-bold mt-0.5">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

export default async function ApiDocPage() {
  const session = await auth();
  const userId = session?.user?.id;

  let isPro = false;
  if (userId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPro: true },
    }).catch(() => null);
    isPro = dbUser?.isPro ?? false;
  }

  // Bouton CTA selon l'état de connexion
  const CtaButton = () => {
    if (!userId) {
      return (
        <Link
          href="/login?callbackUrl=/api-doc"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2f6fb8] text-white rounded-xl text-sm font-bold hover:bg-[#1a5a9e] transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">login</span>
          Se connecter pour obtenir une clé
        </Link>
      );
    }
    if (!isPro) {
      return (
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">upgrade</span>
          Passer en compte Pro
        </Link>
      );
    }
    return (
      <Link
        href="/profile/api-key"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2f6fb8] text-white rounded-xl text-sm font-bold hover:bg-[#1a5a9e] transition-colors"
      >
        <span className="material-symbols-outlined text-[18px]">key</span>
        Gérer ma clé API
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-slate-800">
      <Navbar />

      <main className="pt-36 pb-20 px-4 max-w-4xl mx-auto space-y-12">

        {/* Hero */}
        <div className="bg-white rounded-2xl p-8 shadow-[0_4px_24px_rgba(21,21,125,0.06)]">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#2f6fb8] text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>api</span>
                <h1 className="text-2xl font-extrabold text-slate-900 font-['Manrope']">API Deal&amp;Co</h1>
                <span className="text-[10px] font-bold bg-[#e1e0ff] text-[#2f6fb8] px-2 py-0.5 rounded-full">v1</span>
              </div>
              <p className="text-slate-500 leading-relaxed max-w-xl">
                Publiez des annonces <strong className="text-slate-700">automobiles</strong> et <strong className="text-slate-700">immobilières</strong> directement depuis votre logiciel de gestion, site de diffusion, ou outil d'automatisation (Make, Zapier, n8n…).
              </p>
            </div>
            <CtaButton />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
            {[
              { icon: "lock", title: "Sécurisé", desc: "HTTPS + clé API Bearer par compte" },
              { icon: "bolt", title: "Instantané", desc: "Annonce en ligne dès la requête" },
              { icon: "business", title: "Réservé aux pros", desc: "Comptes professionnels uniquement" },
            ].map((f) => (
              <div key={f.title} className="bg-[#f5f7fa] rounded-xl p-4 flex gap-3 items-start">
                <span className="material-symbols-outlined text-[#2f6fb8] text-[22px] mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>{f.icon}</span>
                <div>
                  <p className="text-sm font-bold text-slate-800">{f.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Authentification */}
        <div className="bg-white rounded-2xl p-8 shadow-[0_4px_24px_rgba(21,21,125,0.06)] space-y-5">
          <h2 className="text-lg font-extrabold text-slate-900 font-['Manrope'] flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#2f6fb8]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#2f6fb8] text-[16px]">lock</span>
            </span>
            Authentification
          </h2>
          <p className="text-sm text-slate-600">
            Toutes les requêtes doivent inclure votre clé dans le header{" "}
            <code className="bg-[#f5f7fa] text-[#2f6fb8] px-1.5 py-0.5 rounded font-mono text-xs">Authorization</code>.
          </p>
          <ol className="space-y-2">
            <Step n={1}>Connectez-vous avec un compte <strong>professionnel</strong></Step>
            <Step n={2}>Rendez-vous dans <Link href="/profile/api-key" className="text-[#2f6fb8] hover:underline">Mon profil → API</Link></Step>
            <Step n={3}>Donnez un nom à votre clé et cliquez sur <strong>"Générer"</strong></Step>
            <Step n={4}>Copiez la clé — elle n'est affichée <strong>qu'une seule fois</strong></Step>
          </ol>
          <CodeBlock label="Header à inclure dans chaque requête" code={CODE.auth} />
          <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
            <span className="material-symbols-outlined text-[18px] mt-0.5 shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            <p>Votre clé commence toujours par <code className="font-mono">dc_live_</code>. Ne la partagez jamais — elle donne accès à votre compte.</p>
          </div>
        </div>

        {/* Démarrage rapide */}
        <div className="bg-white rounded-2xl p-8 shadow-[0_4px_24px_rgba(21,21,125,0.06)] space-y-5">
          <h2 className="text-lg font-extrabold text-slate-900 font-['Manrope'] flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#2f6fb8]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#2f6fb8] text-[16px]">rocket_launch</span>
            </span>
            Démarrage rapide
          </h2>
          <p className="text-sm text-slate-600">Publiez votre première annonce en 30 secondes.</p>
          <CodeBlock label="cURL — exemple minimal" code={CODE.curl} />
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Réponse · 201 Created</p>
            <CodeBlock code={CODE.response} />
          </div>
          <p className="text-sm text-slate-500">
            Le champ <code className="bg-[#f5f7fa] text-[#2f6fb8] px-1.5 py-0.5 rounded font-mono text-xs">url</code> contient le lien direct vers l'annonce publiée.
          </p>
        </div>

        {/* Champs requis */}
        <div className="bg-white rounded-2xl p-8 shadow-[0_4px_24px_rgba(21,21,125,0.06)] space-y-4">
          <h2 className="text-lg font-extrabold text-slate-900 font-['Manrope'] flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#2f6fb8]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#2f6fb8] text-[16px]">list_alt</span>
            </span>
            Champs requis
          </h2>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-2 bg-slate-50 border-b border-slate-200">
              <span className="col-span-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Champ</span>
              <span className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Type</span>
              <span className="col-span-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">Description</span>
            </div>
            {[
              ["title",       "string",  "Titre de l'annonce (3–200 caractères)", true],
              ["price",       "number",  "Prix en euros (≥ 0)", true],
              ["category",   "string",  "Véhicules · Immobilier · Multimédia · Mode · Maison · Loisirs · Animaux · Services · Divers", true],
              ["description","string",  "Description complète (10–10 000 caractères)", true],
              ["location",   "string",  "Ville et code postal (ex : Paris 75001)", true],
              ["subcategory","string",  "Sous-catégorie (optionnel)", false],
              ["condition",  "string",  "Neuf · Très bon état · Bon état · État correct · Pour pièces", false],
              ["phone",      "string",  "Numéro de téléphone du vendeur", false],
              ["hidePhone",  "boolean", "true pour masquer le numéro au public", false],
              ["images",     "string[]","URLs des photos (max 15 — voir section Photos)", false],
              ["vehicle",    "object",  "Détails du véhicule (si category = Véhicules)", false],
              ["immo",       "object",  "Détails du bien immobilier (si category = Immobilier)", false],
            ].map(([name, type, desc, req]) => (
              <div key={name as string} className="grid grid-cols-12 items-start px-4 py-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                <div className="col-span-4 flex items-center gap-1.5">
                  <code className="text-[#2f6fb8] font-mono text-xs">{name}</code>
                  {req && <span className="text-[9px] font-bold text-red-500 uppercase">requis</span>}
                </div>
                <span className="col-span-2 text-slate-400 font-mono text-[10px]">{type}</span>
                <span className="col-span-6 text-xs text-slate-500">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Photos */}
        <div className="bg-white rounded-2xl p-8 shadow-[0_4px_24px_rgba(21,21,125,0.06)] space-y-5">
          <h2 className="text-lg font-extrabold text-slate-900 font-['Manrope'] flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#2f6fb8]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#2f6fb8] text-[16px]">photo_library</span>
            </span>
            Photos
          </h2>
          <p className="text-sm text-slate-600">
            Uploadez les photos via <code className="bg-[#f5f7fa] text-[#2f6fb8] px-1.5 py-0.5 rounded font-mono text-xs">POST /api/v1/upload</code>, puis passez les URLs dans le champ <code className="bg-[#f5f7fa] text-[#2f6fb8] px-1.5 py-0.5 rounded font-mono text-xs">images</code>.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Format", value: "multipart/form-data" },
              { label: "Champ", value: "file" },
              { label: "Taille max", value: "10 Mo / photo" },
              { label: "Types", value: "JPEG, PNG, WebP, GIF" },
              { label: "Max photos", value: "15 par annonce" },
              { label: "Stockage", value: "Vercel Blob CDN" },
            ].map((f) => (
              <div key={f.label} className="bg-[#f5f7fa] rounded-xl px-4 py-3">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{f.label}</p>
                <p className="text-sm text-slate-700 font-mono mt-0.5">{f.value}</p>
              </div>
            ))}
          </div>
          <CodeBlock label="Workflow upload + annonce" code={CODE.upload} />
        </div>

        {/* Erreurs */}
        <div className="bg-white rounded-2xl p-8 shadow-[0_4px_24px_rgba(21,21,125,0.06)] space-y-4">
          <h2 className="text-lg font-extrabold text-slate-900 font-['Manrope'] flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#2f6fb8]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#2f6fb8] text-[16px]">error</span>
            </span>
            Codes d'erreur
          </h2>
          <div className="space-y-3">
            {[
              { code: "201", label: "Created",       color: "bg-emerald-50 border-emerald-200 text-emerald-700", desc: "Annonce créée avec succès." },
              { code: "400", label: "Bad Request",   color: "bg-amber-50 border-amber-200 text-amber-700",       desc: "Champ requis manquant ou invalide." },
              { code: "401", label: "Unauthorized",  color: "bg-red-50 border-red-200 text-red-700",             desc: "Clé API absente, invalide ou révoquée." },
              { code: "429", label: "Too Many Reqs", color: "bg-orange-50 border-orange-200 text-orange-700",    desc: "Trop de requêtes. Patientez avant de réessayer." },
              { code: "500", label: "Server Error",  color: "bg-slate-50 border-slate-200 text-slate-600",       desc: "Erreur interne. Réessayez dans quelques secondes." },
            ].map((e) => (
              <div key={e.code} className={`flex items-start gap-4 border rounded-xl px-5 py-3 ${e.color}`}>
                <span className="font-mono text-xl font-black shrink-0">{e.code}</span>
                <div>
                  <p className="font-bold text-sm">{e.label}</p>
                  <p className="text-xs mt-0.5 opacity-80">{e.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA bas */}
        <div className="bg-[#2f6fb8] rounded-2xl p-8 text-white text-center space-y-4">
          <p className="text-lg font-extrabold font-['Manrope']">Prêt à intégrer l'API ?</p>
          <p className="text-sm text-blue-100">Créez votre clé API en quelques secondes depuis votre espace professionnel.</p>
          <CtaButton />
        </div>

      </main>

      <SiteFooter />
    </div>
  );
}

import Link from "next/link";

const SERVICES = [
  { icon: "home", label: "Garde à domicile", desc: "Votre animal reste chez vous ou chez le pet-sitter." },
  { icon: "directions_walk", label: "Promenade", desc: "Sortie quotidienne par un promeneur de confiance." },
  { icon: "hotel", label: "Pension", desc: "Hébergement professionnel pendant vos vacances." },
];

export default function PetHomePage() {
  return (
    <>
      <section className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 text-white">
        <div className="max-w-[1248px] mx-auto px-6 py-20 lg:py-28 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-block text-xs uppercase tracking-widest text-amber-300 font-semibold mb-3">
              Nouveau · 100% animaux
            </span>
            <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight mb-5">
              Confiez votre animal à un pro <span className="text-amber-300">vérifié</span>.
            </h1>
            <p className="text-lg text-emerald-100 mb-8 max-w-xl">
              Pet-sitters, éleveurs, toiletteurs et vétérinaires sélectionnés. Réservation et
              paiement sécurisés — vous ne payez que si la prestation est confirmée.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/pet/recherche?service=garde"
                className="px-6 py-3 rounded-full bg-amber-400 text-emerald-950 font-semibold hover:bg-amber-300 transition"
              >
                Trouver un pet-sitter
              </Link>
              <Link
                href="/pet/compte-pro"
                className="px-6 py-3 rounded-full border border-emerald-300/40 text-white font-semibold hover:bg-emerald-800 transition"
              >
                Je suis un pro
              </Link>
            </div>
          </div>
          <div className="hidden lg:flex justify-center">
            <div className="w-72 h-72 rounded-full bg-emerald-500/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-amber-300" style={{ fontSize: 180 }}>pets</span>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-[1248px] mx-auto px-6 py-16">
        <h2 className="text-2xl lg:text-3xl font-extrabold text-center mb-10">Nos services</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {SERVICES.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100">
              <span className="material-symbols-outlined text-emerald-600 mb-3" style={{ fontSize: 36 }}>{s.icon}</span>
              <h3 className="font-bold text-lg mb-1">{s.label}</h3>
              <p className="text-sm text-slate-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white border-y border-emerald-100">
        <div className="max-w-[1248px] mx-auto px-6 py-16 grid md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-4xl font-extrabold text-emerald-700 mb-1">100%</div>
            <div className="text-sm text-slate-600">Pros vérifiés (KYC Stripe)</div>
          </div>
          <div>
            <div className="text-4xl font-extrabold text-emerald-700 mb-1">10%</div>
            <div className="text-sm text-slate-600">Commission plateforme transparente</div>
          </div>
          <div>
            <div className="text-4xl font-extrabold text-emerald-700 mb-1">0€</div>
            <div className="text-sm text-slate-600">Frais cachés. Pas de surprise.</div>
          </div>
        </div>
      </section>
    </>
  );
}

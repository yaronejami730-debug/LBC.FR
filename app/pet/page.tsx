import Link from "next/link";

const SERVICES = [
  { icon: "home", label: "Garde à domicile", desc: "Votre animal reste chez vous ou chez le pet-sitter.", href: "/pet/recherche?service=GARDE_DOMICILE" },
  { icon: "hotel", label: "Garde chez le pro", desc: "Pension chez un pet-sitter sélectionné et noté.", href: "/pet/recherche?service=GARDE_CHEZ_PRO" },
  { icon: "directions_walk", label: "Promenade", desc: "Sortie quotidienne par un promeneur de confiance.", href: "/pet/recherche?service=PROMENADE" },
];

const TRUST = [
  { icon: "verified_user", value: "100%", label: "Identité vérifiée (KYC Stripe)" },
  { icon: "lock", value: "10%", label: "Commission plateforme transparente" },
  { icon: "savings", value: "0€", label: "Frais cachés. Vous ne payez que la prestation." },
];

export default function PetHomePage() {
  return (
    <>
      <section className="bg-gradient-to-br from-[#2f6fb8] to-[#1a5a9e] text-white">
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-24 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-white/90 font-semibold mb-3 font-['Manrope']">
              <span className="material-symbols-outlined text-[16px]">pets</span>
              Nouveau · 100% animaux
            </span>
            <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight mb-5 font-['Manrope']">
              Confiez votre animal à un pet-sitter <span className="text-[#c0c1ff]">vérifié</span>.
            </h1>
            <p className="text-lg text-white/90 mb-8 max-w-xl leading-relaxed">
              Particuliers passionnés et professionnels du pet-sitting près de chez vous. Réservation et
              paiement sécurisés &mdash; vous ne payez que si la prestation est confirmée.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/pet/recherche?service=GARDE_DOMICILE"
                className="px-6 py-3 rounded-full bg-white text-[#2f6fb8] font-bold hover:bg-slate-100 transition-colors"
              >
                Trouver un pet-sitter
              </Link>
              <Link
                href="/pet/compte-pro"
                className="px-6 py-3 rounded-full border border-white/40 text-white font-semibold hover:bg-white/10 transition-colors"
              >
                Devenir pet-sitter
              </Link>
            </div>
          </div>
          <div className="hidden lg:flex justify-center">
            <div className="w-72 h-72 rounded-full bg-white/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-white/90" style={{ fontSize: 180 }}>pets</span>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="text-2xl lg:text-3xl font-extrabold text-center mb-10 font-['Manrope']">Nos services</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {SERVICES.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-[#2f6fb8] hover:shadow-md transition-all"
            >
              <span className="material-symbols-outlined text-[#2f6fb8] mb-3" style={{ fontSize: 36 }}>{s.icon}</span>
              <h3 className="font-bold text-lg mb-1 font-['Manrope']">{s.label}</h3>
              <p className="text-sm text-slate-600">{s.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-8 text-center">
          {TRUST.map((t) => (
            <div key={t.label}>
              <span className="material-symbols-outlined text-[#2f6fb8] mb-2" style={{ fontSize: 32 }}>{t.icon}</span>
              <div className="text-4xl font-extrabold text-slate-900 mb-1 font-['Manrope']">{t.value}</div>
              <div className="text-sm text-slate-600">{t.label}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

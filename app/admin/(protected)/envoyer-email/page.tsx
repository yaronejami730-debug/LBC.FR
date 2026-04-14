import DiscoveryEmailForm from "./DiscoveryEmailForm";

export default function EnvoyerEmailPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#191c1e] font-headline">
          Email de découverte
        </h1>
        <p className="text-sm text-[#777683] mt-1">
          Envoyez un email de présentation de la plateforme à un contact en un clic.
        </p>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: "alternate_email",
            step: "1",
            label: "Entrez l'email",
            desc: "Saisissez l'adresse du contact à inviter",
          },
          {
            icon: "send",
            step: "2",
            label: "Envoi instantané",
            desc: "L'email est envoyé immédiatement via Brevo",
          },
          {
            icon: "storefront",
            step: "3",
            label: "Il découvre Deal & Co",
            desc: "Un beau mail présente la plateforme avec un lien",
          },
        ].map(({ icon, step, label, desc }) => (
          <div
            key={step}
            className="bg-white rounded-2xl border border-[#eceef0] p-5 flex items-start gap-4"
          >
            <div className="w-10 h-10 rounded-xl bg-[#2f6fb8]/10 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[20px] text-[#2f6fb8]">
                {icon}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#777683] mb-0.5">
                Étape {step}
              </p>
              <p className="text-sm font-bold text-[#191c1e]">{label}</p>
              <p className="text-xs text-[#777683] mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <DiscoveryEmailForm />
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comment ça marche",
  description: "Le fonctionnement de Deal&Co Pet : recherche, réservation, paiement sécurisé et commission 10%.",
};

const CLIENT_STEPS = [
  { icon: "search", title: "Trouvez un pet-sitter", desc: "Recherchez par service et par ville parmi les profils vérifiés." },
  { icon: "event", title: "Réservez vos dates", desc: "Choisissez les dates et le nombre d'animaux, puis payez en ligne." },
  { icon: "lock", title: "Paiement sécurisé", desc: "Votre paiement est encaissé par la plateforme via Stripe." },
  { icon: "verified", title: "Prestation confirmée", desc: "Le pet-sitter est payé après la fin de la garde. Vous laissez un avis." },
];

const PRO_STEPS = [
  { icon: "person_add", title: "Créez votre profil", desc: "Particulier ou pro : présentez-vous et votre logement." },
  { icon: "badge", title: "Vérifiez votre identité", desc: "Onboarding Stripe rapide pour recevoir les paiements." },
  { icon: "sell", title: "Publiez vos prestations", desc: "Garde, promenade : fixez vos tarifs librement." },
  { icon: "payments", title: "Recevez vos paiements", desc: "Le montant moins 10% de commission est viré après chaque prestation." },
];

export default function CommentCaMarchePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-extrabold font-['Manrope'] mb-2">Comment ça marche</h1>
      <p className="text-slate-600 mb-10">
        Deal&amp;Co Pet met en relation propriétaires d&apos;animaux et pet-sitters, avec paiement
        sécurisé et une commission plateforme transparente de 10%.
      </p>

      <Section title="Pour les propriétaires d'animaux" steps={CLIENT_STEPS} />
      <div className="mt-6">
        <Link
          href="/pet/recherche"
          className="inline-block bg-[#2f6fb8] hover:bg-[#2560a0] text-white px-5 py-2.5 rounded-full font-bold text-sm transition-colors"
        >
          Trouver un pet-sitter
        </Link>
      </div>

      <div className="mt-12">
        <Section title="Pour les pet-sitters" steps={PRO_STEPS} />
        <div className="mt-6">
          <Link
            href="/pet/compte-pro"
            className="inline-block bg-[#2f6fb8] hover:bg-[#2560a0] text-white px-5 py-2.5 rounded-full font-bold text-sm transition-colors"
          >
            Devenir pet-sitter
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  steps,
}: {
  title: string;
  steps: { icon: string; title: string; desc: string }[];
}) {
  return (
    <>
      <h2 className="text-xl font-bold font-['Manrope'] mb-4">{title}</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {steps.map((s, i) => (
          <div key={s.title} className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#2f6fb8]/10 text-[#2f6fb8] text-sm font-extrabold">
                {i + 1}
              </span>
              <span className="material-symbols-outlined text-[#2f6fb8]">{s.icon}</span>
            </div>
            <h3 className="font-bold font-['Manrope']">{s.title}</h3>
            <p className="text-sm text-slate-600 mt-1">{s.desc}</p>
          </div>
        ))}
      </div>
    </>
  );
}

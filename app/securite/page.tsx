import { TrustHero } from "@/components/trust/TrustHero";
import { TrustStrip } from "@/components/trust/TrustStrip";
import { TrustCard } from "@/components/trust/TrustCard";
import { TrustBadge } from "@/components/trust/TrustBadge";
import { TrustLockNote } from "@/components/trust/TrustLockNote";
import { TrustFooter } from "@/components/trust/TrustFooter";

export const metadata = {
  title: "Sécurité & Confiance — Deal & Co",
  description:
    "Hébergement européen, chiffrement TLS, conformité RGPD. Découvrez comment Deal & Co protège vos données.",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-['Manrope'] text-xs font-extrabold uppercase tracking-wider text-slate-400">
        {title}
      </h2>
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(21,21,125,0.04)] dark:border-white/5 dark:bg-white/[0.03]">
        {children}
      </div>
    </section>
  );
}

export default function SecuritePage() {
  return (
    <>
      <div className="mx-auto max-w-5xl space-y-10 px-6 py-12">
        <TrustHero />

        <Section title="Variantes — TrustStrip">
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                register
              </p>
              <TrustStrip variant="register" />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                listing
              </p>
              <TrustStrip variant="listing" />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                upload
              </p>
              <TrustStrip variant="upload" />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                footer
              </p>
              <TrustStrip variant="footer" />
            </div>
          </div>
        </Section>

        <Section title="TrustCard">
          <TrustCard />
        </Section>

        <Section title="TrustBadge — tons">
          <div className="flex flex-wrap gap-2">
            <TrustBadge icon="public" label="Primary" tone="primary" />
            <TrustBadge icon="verified" label="Emerald" tone="emerald" />
            <TrustBadge icon="lock" label="Neutral" tone="neutral" />
            <TrustBadge icon="shield" label="Small" tone="primary" size="sm" />
          </div>
        </Section>

        <Section title="TrustLockNote — variantes">
          <div className="space-y-3">
            <TrustLockNote variant="password" />
            <TrustLockNote variant="personal-info" />
            <TrustLockNote variant="upload-photo" />
            <TrustLockNote variant="upload-doc" />
            <TrustLockNote variant="payment" />
          </div>
        </Section>

        <Section title="Mock — Formulaire inscription avec trust">
          <div className="max-w-sm space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-tight text-[#2f6fb8]">
                Mot de passe
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="mt-1.5 w-full rounded-xl border-none bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-[#2f6fb8]"
              />
              <div className="mt-2">
                <TrustLockNote variant="password" />
              </div>
            </div>
            <button
              type="button"
              className="w-full rounded-full bg-[#2f6fb8] py-3.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(21,21,125,0.2)]"
            >
              Créer mon compte
            </button>
            <TrustStrip variant="register" className="justify-center pt-2" />
          </div>
        </Section>
      </div>

      <TrustFooter />
    </>
  );
}

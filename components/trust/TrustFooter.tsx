import Link from "next/link";

function TrustItem({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-[#2f6fb8]/20 hover:shadow-[0_4px_20px_rgba(21,21,125,0.04)] dark:border-white/5 dark:bg-white/[0.03] dark:hover:border-[#2f6fb8]/30">
      <span className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-[#2f6fb8]/10 text-[#2f6fb8] dark:bg-[#2f6fb8]/15">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </span>
      <p className="font-['Manrope'] text-[13px] font-extrabold text-slate-900 dark:text-white">
        {title}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-white/60">
        {body}
      </p>
    </div>
  );
}

export function TrustFooter() {
  return (
    <section
      aria-label="Confiance et sécurité"
      className="border-t border-slate-200 bg-gradient-to-b from-white to-slate-50/60 dark:from-zinc-950 dark:to-zinc-900"
    >
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6 flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[#2f6fb8] text-[18px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            verified_user
          </span>
          <h2 className="font-['Manrope'] text-sm font-extrabold uppercase tracking-wider text-[#2f6fb8]">
            Confiance &amp; sécurité
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TrustItem
            icon="public"
            title="Données en Europe 🇪🇺"
            body="Serveurs à Dublin (Irlande). Vos données ne quittent pas l'UE."
          />
          <TrustItem
            icon="verified"
            title="Conforme RGPD"
            body="Accès, rectification, suppression — accessibles depuis votre compte."
          />
          <TrustItem
            icon="encrypted"
            title="Chiffrement TLS 1.3"
            body="Connexions chiffrées. Mots de passe hachés avec bcrypt."
          />
          <TrustItem
            icon="cookie_off"
            title="Zéro cookie publicitaire tiers"
            body="Aucune revente de vos données. Aucun tracking sans consentement."
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 pt-5 text-xs text-slate-500 dark:border-white/5 dark:text-white/60">
          <Link href="/confidentialite" className="font-medium text-[#2f6fb8] hover:underline">
            Politique de confidentialité
          </Link>
          <Link href="/cgu" className="font-medium text-[#2f6fb8] hover:underline">
            CGU
          </Link>
          <Link
            href="/preferences/email"
            className="font-medium text-[#2f6fb8] hover:underline"
          >
            Préférences email
          </Link>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Service opérationnel
          </span>
        </div>
      </div>
    </section>
  );
}

function Pill({ icon, text }: { icon: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-900 shadow-[0_2px_8px_rgba(21,21,125,0.05)] ring-1 ring-slate-200 dark:bg-white/5 dark:text-white dark:ring-white/10">
      <span className="material-symbols-outlined text-[15px] text-[#2f6fb8]">
        {icon}
      </span>
      {text}
    </span>
  );
}

export function TrustHero() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2f6fb8]/[0.04] via-white to-emerald-50/40 p-8 sm:p-12 dark:from-[#2f6fb8]/10 dark:via-zinc-950 dark:to-emerald-500/5">
      <div className="absolute right-6 top-6 hidden sm:block">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_10px_30px_rgba(21,21,125,0.08)] dark:bg-white/5">
          <span
            className="material-symbols-outlined text-[28px] text-[#2f6fb8]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            shield
          </span>
        </div>
      </div>

      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Sécurité &amp; confiance
      </span>

      <h1 className="mt-4 font-['Manrope'] text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl dark:text-white">
        Tes données restent <br className="hidden sm:block" />
        <span className="text-[#2f6fb8]">en Europe.</span>
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-[15px] dark:text-white/70">
        Hébergement à Dublin, chiffrement TLS, mots de passe hachés, modération
        active. Pas de cookies publicitaires tiers, pas de revente — tu gardes
        le contrôle.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Pill icon="public" text="Stockage UE 🇪🇺" />
        <Pill icon="verified" text="Conforme RGPD" />
        <Pill icon="encrypted" text="TLS 1.3" />
        <Pill icon="cookie_off" text="0 cookie pub tiers" />
      </div>
    </section>
  );
}

import Link from "next/link";

export function TrustCard({
  title = "Tes données restent en Europe",
  body = "Stockage chiffré sur des serveurs situés en Irlande (UE). Aucune revente, aucun cookie publicitaire tiers.",
  href = "/confidentialite",
}: {
  title?: string;
  body?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-3.5 transition hover:bg-emerald-50 dark:border-emerald-500/15 dark:bg-emerald-500/5 dark:hover:bg-emerald-500/10"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        <span
          className="material-symbols-outlined text-[18px]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          shield
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-emerald-900 dark:text-emerald-200">
          {title}
        </p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-emerald-800/80 dark:text-emerald-200/70">
          {body}
        </p>
      </div>
      <span className="material-symbols-outlined text-[18px] text-emerald-700/60 transition group-hover:translate-x-0.5 dark:text-emerald-300/60">
        arrow_forward
      </span>
    </Link>
  );
}

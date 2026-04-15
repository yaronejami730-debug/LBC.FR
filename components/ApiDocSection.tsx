import Link from "next/link";

export default function ApiDocSection() {
  return (
    <section className="bg-[#0b0e17] py-10 px-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-6">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2f6fb8]">
            Intégration logiciel
          </p>
          <p className="text-white font-bold text-sm">
            Postez des annonces depuis votre DMS ou CRM via notre API REST.
          </p>
        </div>
        <Link
          href="/api-doc"
          className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-[#2f6fb8] text-white text-sm font-bold rounded-full hover:bg-[#1a5a9e] transition-all whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[16px]">api</span>
          Documentation API
        </Link>
      </div>
    </section>
  );
}

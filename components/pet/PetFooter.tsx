import Link from "next/link";

const LEGAL_LINKS = [
  { label: "À propos", href: "/a-propos" },
  { label: "Contact", href: "/contact" },
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "CGU", href: "/cgu" },
  { label: "Politique de confidentialité", href: "/confidentialite" },
];

const SERVICES = [
  { label: "Garde à domicile", href: "/pet/recherche?service=GARDE_DOMICILE" },
  { label: "Garde chez le pro", href: "/pet/recherche?service=GARDE_CHEZ_PRO" },
  { label: "Promenade chiens", href: "/pet/recherche?service=PROMENADE" },
];

const PRO_LINKS = [
  { label: "Devenir prestataire", href: "/pet/compte-pro" },
  { label: "Mon espace pro", href: "/pet/compte-pro" },
  { label: "Comment ça marche", href: "/pet/comment-ca-marche" },
];

export default function PetFooter() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-12">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src="/logo.png" alt="Deal&Co" className="w-32 h-auto" />
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2f6fb8]/10 text-[#2f6fb8] text-[10px] font-bold uppercase tracking-wider font-['Manrope']">
                Pet
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Mise en relation 100% animaux. Pet-sitters, éleveurs, toiletteurs et vétérinaires vérifiés. Paiement sécurisé, commission transparente 10%.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-extrabold text-on-surface uppercase tracking-wider mb-3 font-['Manrope']">
              Services
            </h3>
            <ul className="space-y-1.5">
              {SERVICES.map((s) => (
                <li key={s.href}>
                  <Link href={s.href} className="text-xs text-slate-500 hover:text-[#2f6fb8] transition-colors">
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-extrabold text-on-surface uppercase tracking-wider mb-3 font-['Manrope']">
              Professionnels
            </h3>
            <ul className="space-y-1.5">
              {PRO_LINKS.map((p) => (
                <li key={p.label}>
                  <Link href={p.href} className="text-xs text-slate-500 hover:text-[#2f6fb8] transition-colors">
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-extrabold text-on-surface uppercase tracking-wider mb-3 font-['Manrope']">
              Deal&amp;Co
            </h3>
            <ul className="space-y-1.5">
              <li>
                <Link href="/" className="text-xs text-slate-500 hover:text-[#2f6fb8] transition-colors">
                  Marketplace généraliste
                </Link>
              </li>
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-xs text-slate-500 hover:text-[#2f6fb8] transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">
            © {new Date().getFullYear()} Deal&amp;Co Pet — un service de Deal&amp;Co
          </p>
          <nav className="flex items-center flex-wrap justify-center gap-1">
            {LEGAL_LINKS.map((link, i) => (
              <span key={link.href} className="flex items-center">
                {i > 0 && <span className="text-slate-300 mx-2 select-none">·</span>}
                <Link href={link.href} className="text-[11px] text-slate-400 hover:text-[#2f6fb8] transition-colors">
                  {link.label}
                </Link>
              </span>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

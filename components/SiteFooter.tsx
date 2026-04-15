import Link from "next/link";

const LINKS = [
  { label: "Mentions légales",            href: "/mentions-legales" },
  { label: "CGU",                          href: "/cgu" },
  { label: "Politique de confidentialité", href: "/confidentialite" },
  { label: "API",                          href: "/api-doc" },
];

export default function SiteFooter() {
  return (
    <footer className="bg-white border-t border-slate-200 px-6 py-5">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          © 2026 Deal&amp;Co — Petites annonces gratuites entre particuliers et professionnels
        </p>
        <nav className="flex items-center flex-wrap justify-center gap-1">
          {LINKS.map((link, i) => (
            <span key={link.href} className="flex items-center">
              {i > 0 && <span className="text-slate-300 mx-2 select-none">·</span>}
              <Link
                href={link.href}
                className="text-xs text-slate-400 hover:text-[#2f6fb8] transition-colors"
              >
                {link.label}
              </Link>
            </span>
          ))}
        </nav>
      </div>
    </footer>
  );
}

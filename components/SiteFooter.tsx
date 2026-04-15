import Link from "next/link";

const LINKS = [
  { label: "Mentions légales",          href: "/mentions-legales" },
  { label: "CGU",                        href: "/cgu" },
  { label: "Politique de confidentialité", href: "/confidentialite" },
  { label: "API",                        href: "/api-doc" },
];

export default function SiteFooter() {
  return (
    <footer className="bg-[#0b0e17] border-t border-white/10 px-6 py-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-[#6b7280]">
          © {new Date().getFullYear()} Deal&amp;Co — Petites annonces gratuites entre particuliers
        </p>
        <nav className="flex items-center gap-1 flex-wrap justify-center">
          {LINKS.map((link, i) => (
            <span key={link.href} className="flex items-center">
              {i > 0 && <span className="text-[#30363d] mx-2 select-none">·</span>}
              <Link
                href={link.href}
                className={`text-xs transition-colors ${
                  link.label === "API"
                    ? "text-[#60a5fa] font-semibold hover:text-white"
                    : "text-[#6b7280] hover:text-[#e6edf3]"
                }`}
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

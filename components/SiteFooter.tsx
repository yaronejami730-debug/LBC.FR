import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { TOP_CITIES } from "@/lib/cities";

const LEGAL_LINKS = [
  { label: "À propos", href: "/a-propos" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "CGU", href: "/cgu" },
  { label: "Politique de confidentialité", href: "/confidentialite" },
  { label: "API", href: "/api-doc" },
];

const POPULAR_QUERIES = [
  { label: "Renault Clio occasion", href: "/prix/renault-clio-occasion" },
  { label: "Peugeot 208 occasion", href: "/prix/peugeot-208-occasion" },
  { label: "BMW Série 3 occasion", href: "/prix/bmw-serie-3-occasion" },
  { label: "iPhone 14 occasion", href: "/prix/iphone-14-occasion" },
  { label: "iPhone 13 occasion", href: "/prix/iphone-13-occasion" },
  { label: "Canapé Ikea occasion", href: "/prix/canape-ikea-occasion" },
  { label: "Vélo occasion", href: "/prix/velo-occasion" },
  { label: "Volkswagen Golf occasion", href: "/prix/volkswagen-golf-occasion" },
];

const FOOTER_TOP_CITIES = TOP_CITIES.slice(0, 24);
const FOOTER_CATEGORIES = CATEGORIES.slice(0, 14);

export default function SiteFooter() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-12">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div>
            <h3 className="text-xs font-extrabold text-on-surface uppercase tracking-wider mb-3 font-['Manrope']">
              Catégories populaires
            </h3>
            <ul className="space-y-1.5">
              {FOOTER_CATEGORIES.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/annonces/${c.id}`}
                    title={`Annonces ${c.label}`}
                    className="text-xs text-slate-500 hover:text-[#2f6fb8] transition-colors"
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-extrabold text-on-surface uppercase tracking-wider mb-3 font-['Manrope']">
              Annonces par ville
            </h3>
            <ul className="grid grid-cols-2 gap-x-2 gap-y-1.5">
              {FOOTER_TOP_CITIES.map((city) => (
                <li key={city.slug}>
                  <Link
                    href={`/ville/${city.slug}`}
                    title={`Annonces à ${city.name}`}
                    className="text-xs text-slate-500 hover:text-[#2f6fb8] transition-colors"
                  >
                    {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-extrabold text-on-surface uppercase tracking-wider mb-3 font-['Manrope']">
              Recherches populaires
            </h3>
            <ul className="space-y-1.5">
              {POPULAR_QUERIES.map((q) => (
                <li key={q.href}>
                  <Link
                    href={q.href}
                    title={`Voir les prix : ${q.label}`}
                    className="text-xs text-slate-500 hover:text-[#2f6fb8] transition-colors"
                  >
                    {q.label}
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
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    title={l.label}
                    className="text-xs text-slate-500 hover:text-[#2f6fb8] transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/nouveautes"
                  title="Dernières annonces publiées"
                  className="text-xs text-slate-500 hover:text-[#2f6fb8] transition-colors"
                >
                  Dernières annonces
                </Link>
              </li>
              <li>
                <Link
                  href="/post"
                  title="Publier une annonce gratuite"
                  className="text-xs text-slate-500 hover:text-[#2f6fb8] transition-colors"
                >
                  Publier une annonce
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">
            © 2026 Deal&amp;Co — Petites annonces gratuites entre particuliers et professionnels
          </p>
          <nav className="flex items-center flex-wrap justify-center gap-1">
            {LEGAL_LINKS.map((link, i) => (
              <span key={link.href} className="flex items-center">
                {i > 0 && <span className="text-slate-300 mx-2 select-none">·</span>}
                <Link
                  href={link.href}
                  title={link.label}
                  className="text-[11px] text-slate-400 hover:text-[#2f6fb8] transition-colors"
                >
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

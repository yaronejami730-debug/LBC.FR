"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CATEGORIES } from "@/lib/categories";

/**
 * Menu principal — plein écran, ouvert par le bouton hamburger.
 *
 * Il remplace la barre du bas. Cette barre coûtait une soixantaine de pixels
 * en permanence, sur des écrans où la hauteur est la ressource rare, pour
 * cinq liens dont trois n'étaient utiles qu'une fois sur dix. Le même contenu
 * tient ici sans rien occuper le reste du temps.
 *
 * L'ordre suit ce qu'on vient faire, pas la logique du catalogue :
 *   chercher → déposer → sa propre activité → son compte → les rubriques.
 * Les catégories sont donc reléguées en bas, en petit : on arrive sur Deal&Co
 * pour chercher quelque chose de précis, rarement pour flâner dans « Maison ».
 */

const PRIMARY = [
  { href: "/search", label: "Recherche", icon: "search", title: "Rechercher une annonce" },
  { href: "/post", label: "Déposer une annonce", icon: "add_circle", title: "Déposer une annonce gratuite" },
];

const PERSONAL = [
  { href: "/messages", label: "Messages", icon: "chat_bubble", title: "Ma messagerie" },
  { href: "/favoris", label: "Favoris", icon: "favorite", title: "Mes annonces favorites" },
  { href: "/recherches", label: "Mes alertes", icon: "notifications", title: "Mes recherches enregistrées" },
];

// Les annonces d'un compte vivent sur l'onglet par défaut de `/profile` : pas
// de route dédiée, donc pas de lien qui promettrait une page inexistante.
const ACCOUNT = [
  { href: "/profile", label: "Mon compte", icon: "person", title: "Mon compte" },
  { href: "/profile", label: "Mes annonces", icon: "list_alt", title: "Mes annonces publiées" },
];

const PRACTICAL = [
  { href: "/a-propos", label: "À propos", title: "À propos de Deal&Co" },
  { href: "/contact", label: "Nous contacter", title: "Contacter Deal&Co" },
];

const LEGAL = [
  { href: "/cgu", label: "Conditions générales", title: "Conditions générales d'utilisation" },
  { href: "/mentions-legales", label: "Mentions légales", title: "Mentions légales" },
  { href: "/confidentialite", label: "Confidentialité", title: "Politique de confidentialité" },
];

export default function CategoryDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: session } = useSession();

  // Le menu couvre l'écran : laisser la page défiler dessous donne une
  // impression de flottement, et on rouvre sur une position différente.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // Échap ferme : c'est le réflexe sur un panneau qui prend tout l'écran.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const close = () => setIsOpen(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="mr-3 p-2 rounded-full hover:bg-slate-100 transition-colors text-[#2f6fb8] active:scale-95"
        aria-label="Menu"
        aria-expanded={isOpen}
      >
        <span
          className="material-symbols-outlined text-2xl"
          style={{ fontVariationSettings: "'FILL' 0, 'wght' 600" }}
        >
          menu
        </span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu principal"
          className="fixed inset-0 z-[101] bg-white flex flex-col"
        >
          {/* En-tête : la marque au centre, la sortie à droite. */}
          <div className="relative flex items-center justify-center border-b border-slate-100 px-4 py-4 shrink-0">
            <Link href="/" onClick={close} title="Accueil Deal&Co">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Deal & Co" className="h-8 w-auto" />
            </Link>
            <button
              onClick={close}
              aria-label="Fermer le menu"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-slate-500">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">
            {/* Ce pour quoi on vient. */}
            <nav className="px-3 py-4">
              {PRIMARY.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.title}
                  onClick={close}
                  className="flex items-center gap-4 px-4 py-4 rounded-2xl hover:bg-slate-50 active:scale-[0.99]"
                >
                  <span
                    className="material-symbols-outlined text-[26px] text-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {item.icon}
                  </span>
                  <span className="text-lg font-extrabold font-['Manrope']">{item.label}</span>
                </Link>
              ))}
            </nav>

            <div className="mx-6 border-t border-slate-100" />

            {/* Son activité sur le site. */}
            <nav className="px-3 py-3">
              {PERSONAL.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.title}
                  onClick={close}
                  className="flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-slate-50"
                >
                  <span className="material-symbols-outlined text-[22px] text-slate-400">{item.icon}</span>
                  <span className="text-base font-bold">{item.label}</span>
                </Link>
              ))}
            </nav>

            <div className="mx-6 border-t border-slate-100" />

            {/* Compte — ou l'invitation à en créer un. */}
            <nav className="px-3 py-3">
              {session?.user ? (
                ACCOUNT.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    title={item.title}
                    onClick={close}
                    className="flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-slate-50"
                  >
                    <span className="material-symbols-outlined text-[22px] text-slate-400">{item.icon}</span>
                    <span className="text-base font-bold">{item.label}</span>
                  </Link>
                ))
              ) : (
                <div className="px-4 py-2 flex flex-wrap gap-2">
                  <Link
                    href="/login"
                    onClick={close}
                    title="Se connecter"
                    className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white"
                  >
                    Se connecter
                  </Link>
                  <Link
                    href="/register"
                    onClick={close}
                    title="Créer un compte"
                    className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-bold text-on-surface-variant"
                  >
                    Créer un compte
                  </Link>
                </div>
              )}
            </nav>

            {/* Les rubriques, en bas et en petit : elles servent à flâner, pas
                à faire ce pour quoi on a ouvert l'application. */}
            <div className="px-6 pt-4 pb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-2">
                Catégories
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                {CATEGORIES.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/annonces/${cat.id}`}
                    title={`Annonces ${cat.label}`}
                    onClick={close}
                    className="text-[13px] text-slate-500 hover:text-primary"
                  >
                    {cat.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="px-6 pt-4 pb-8 space-y-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1.5">
                  Informations pratiques
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                  {PRACTICAL.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.title}
                      onClick={close}
                      className="text-[13px] text-slate-500 hover:text-primary"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1.5">
                  Informations légales
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                  {LEGAL.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.title}
                      onClick={close}
                      className="text-[13px] text-slate-500 hover:text-primary"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

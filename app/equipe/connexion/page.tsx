import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMemberSession } from "@/lib/pro-member-auth";
import LoginForm from "./LoginForm";

// Un espace de travail n'a rien à faire dans un index de moteur de recherche.
export const metadata: Metadata = {
  title: "Accès équipe — Deal&Co",
  robots: { index: false, follow: false },
};

/**
 * Porte d'entrée des membres d'équipe.
 *
 * Distincte de `/login`, qui est celle des comptes Deal&Co. Un salarié de salon
 * n'a pas de compte Deal&Co — il a un accès à son planning, remis par sa
 * responsable. Confondre les deux portes obligerait à expliquer, sur l'écran de
 * connexion du site, une notion qui ne concerne qu'une poignée d'utilisateurs.
 */
export default async function EquipeConnexionPage() {
  if (await getMemberSession()) redirect("/equipe/agenda");

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Deal & Co" className="h-12 w-auto mx-auto mb-4" />
          <h1 className="text-xl font-extrabold font-['Manrope']">Accès équipe</h1>
          <p className="text-sm text-outline mt-1 leading-relaxed">
            Connectez-vous avec l&apos;identifiant remis par votre établissement pour consulter
            vos rendez-vous.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-[0_8px_24px_rgba(21,21,125,0.04)]">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

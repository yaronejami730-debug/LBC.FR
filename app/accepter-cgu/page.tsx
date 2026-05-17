import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { verifyEmailPrefToken } from "@/lib/email-token";
import AcceptTermsForm from "./AcceptTermsForm";

export const metadata: Metadata = {
  title: "Accepter les CGU — Deal&Co",
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="max-w-md w-full">{children}</div>
    </div>
  );
}

function InvalidLink() {
  return (
    <Shell>
      <div className="text-center">
        <span className="material-symbols-outlined text-5xl text-red-400 block mb-4">link_off</span>
        <h1 className="text-2xl font-extrabold text-on-surface font-['Manrope'] mb-2">Lien invalide</h1>
        <p className="text-outline text-sm mb-6">
          Ce lien est incorrect ou a expiré. Connectez-vous pour gérer votre compte.
        </p>
        <Link href="/login" className="text-primary font-semibold text-sm hover:underline">
          Retour à la connexion
        </Link>
      </div>
    </Shell>
  );
}

export default async function AccepterCguPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const payload = token ? verifyEmailPrefToken(token) : null;
  if (!payload) return <InvalidLink />;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, consentGivenAt: true, marketingConsent: true },
  });
  if (!user) return <InvalidLink />;

  if (user.consentGivenAt) {
    return (
      <Shell>
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-green-500 block mb-4">task_alt</span>
          <h1 className="text-2xl font-extrabold text-on-surface font-['Manrope'] mb-2">
            C'est déjà fait
          </h1>
          <p className="text-outline text-sm mb-6">
            Vous avez déjà accepté nos CGU et notre politique de confidentialité. Rien à faire.
          </p>
          <Link href="/" className="text-primary font-semibold text-sm hover:underline">
            Aller à l'accueil
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <span
            className="material-symbols-outlined text-3xl text-primary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            verified_user
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-on-surface font-['Manrope'] mb-1">
          Une dernière étape
        </h1>
        <p className="text-outline text-sm">
          Bonjour <strong className="text-on-surface">{user.name}</strong> — merci d'accepter nos
          conditions pour continuer à utiliser votre compte.
        </p>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-[0_8px_32px_rgba(21,21,125,0.08)]">
        <AcceptTermsForm userId={user.id} initialMarketing={user.marketingConsent} />
      </div>
    </Shell>
  );
}

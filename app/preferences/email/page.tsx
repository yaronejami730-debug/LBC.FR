import { prisma } from "@/lib/prisma";
import { verifyEmailPrefToken } from "@/lib/email-token";
import EmailPrefForm from "./EmailPrefForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Préférences email — Deal & Co",
  robots: { index: false, follow: false },
};

export default async function EmailPrefPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) return <InvalidLink reason="Lien manquant." />;

  const decoded = verifyEmailPrefToken(token);
  if (!decoded) return <InvalidLink reason="Lien invalide ou expiré." />;

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, email: true, name: true, marketingConsent: true },
  });
  if (!user) return <InvalidLink reason="Compte introuvable." />;

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Deal & Co" className="h-14 w-auto mx-auto mb-3" />
          <h1 className="text-2xl font-extrabold text-on-surface font-['Manrope']">
            Préférences email
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">{user.email}</p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-[0_16px_32px_rgba(21,21,125,0.06)]">
          <EmailPrefForm
            token={token}
            initialConsent={user.marketingConsent}
            name={user.name}
          />
        </div>

        <p className="text-xs text-outline text-center mt-6 leading-relaxed">
          Ce lien est personnel. Vous pouvez modifier vos préférences à tout moment, sans vous connecter.
          <br />
          <Link href="/" className="text-primary hover:underline font-medium">
            Retour à Deal & Co
          </Link>
        </p>
      </div>
    </div>
  );
}

function InvalidLink({ reason }: { reason: string }) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <img src="/logo.png" alt="Deal & Co" className="h-14 w-auto mx-auto mb-4" />
        <div className="bg-white rounded-3xl p-8 shadow-[0_16px_32px_rgba(21,21,125,0.06)]">
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-red-500 text-2xl">link_off</span>
          </div>
          <h1 className="text-lg font-extrabold text-on-surface font-['Manrope'] mb-2">
            Lien non valide
          </h1>
          <p className="text-sm text-on-surface-variant leading-relaxed">{reason}</p>
          <Link
            href="/login"
            className="inline-block mt-6 px-6 py-3 bg-primary text-white rounded-full text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            Se connecter pour gérer ses préférences
          </Link>
        </div>
      </div>
    </div>
  );
}

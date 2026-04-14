import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ActivateForm from "./ActivateForm";

export default async function ActivateAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <span className="material-symbols-outlined text-5xl text-red-400 block mb-4">link_off</span>
          <h1 className="text-2xl font-extrabold text-on-surface font-['Manrope'] mb-2">Lien invalide</h1>
          <p className="text-outline text-sm mb-6">Ce lien d'activation est incorrect ou manquant.</p>
          <Link href="/login" className="text-primary font-semibold text-sm hover:underline">
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: { select: { name: true, email: true } } },
  });

  const isValid = record && !record.used && record.expiresAt > new Date();

  if (!isValid) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <span className="material-symbols-outlined text-5xl text-amber-400 block mb-4">timer_off</span>
          <h1 className="text-2xl font-extrabold text-on-surface font-['Manrope'] mb-2">Lien expiré</h1>
          <p className="text-outline text-sm mb-6">
            Ce lien d'activation a expiré ou a déjà été utilisé. Contactez notre équipe pour en recevoir un nouveau.
          </p>
          <Link href="/login" className="text-primary font-semibold text-sm hover:underline">
            Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span
              className="material-symbols-outlined text-3xl text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              lock_open
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-on-surface font-['Manrope'] mb-1">
            Créez votre mot de passe
          </h1>
          <p className="text-outline text-sm">
            Bienvenue, <strong className="text-on-surface">{record.user.name}</strong> — choisissez un mot de passe pour accéder à votre compte.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_32px_rgba(21,21,125,0.08)]">
          <ActivateForm token={token} />
        </div>

        <p className="text-center text-outline/70 text-xs mt-6">
          Votre email : <span className="font-semibold">{record.user.email}</span>
        </p>
      </div>
    </div>
  );
}

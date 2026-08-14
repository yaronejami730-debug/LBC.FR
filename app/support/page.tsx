import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import SupportClient from "./SupportClient";

export const metadata: Metadata = {
  title: "Support — Deal&Co",
  description: "Écrivez au support Deal&Co et suivez vos demandes.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Support client.
 *
 * Réservé aux comptes connectés, et volontairement : une demande d'aide sans
 * compte n'a ni historique ni destinataire à qui répondre — c'est le rôle du
 * formulaire de contact public. Ici, la conversation appartient à quelqu'un.
 */
export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ ticket?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/support");

  const { ticket } = await searchParams;

  return (
    <div className="bg-surface min-h-screen">
      <Navbar />
      <main className="pt-28 md:pt-36 pb-16 px-4 max-w-5xl mx-auto">
        <h1 className="text-2xl font-extrabold tracking-tight font-['Manrope'] mb-1">
          Support Deal&amp;Co
        </h1>
        <p className="text-sm text-outline mb-5">
          Posez votre question, suivez son avancement, retrouvez l&apos;historique de vos échanges.
        </p>

        <SupportClient initialTicketId={ticket} />
      </main>
    </div>
  );
}

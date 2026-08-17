import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import SupportChat from "./SupportChat";

export const metadata: Metadata = {
  title: "Support — Deal&Co",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Le support, à sa place : dans la messagerie.
 *
 * Écrire au support n'est pas un formulaire à part, c'est une conversation de
 * plus dans la liste — même fenêtre, mêmes bulles, mêmes accusés de lecture que
 * pour un vendeur. L'adresse accepte `?t=` pour ouvrir une discussion précise,
 * ce dont se servent les e-mails de réponse.
 */
export default async function SupportConversationPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/messages/support");

  const { t } = await searchParams;
  return <SupportChat initialTicketId={t} />;
}

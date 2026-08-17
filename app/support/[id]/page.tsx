import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Une discussion de support, ouverte directement par son adresse.
 *
 * Cette page manquait, alors que deux chemins y menaient déjà : l'entrée
 * « Support Deal&Co » de la messagerie, et surtout le bouton « Répondre » des
 * e-mails de réponse — chaque client qui cliquait depuis sa boîte tombait sur
 * une page introuvable.
 *
 * L'adresse porte l'identifiant de la discussion : elle se garde en favori, se
 * retrouve dans l'historique, et survit à un e-mail lu trois jours plus tard.
 * Elle reste donc valable, mais renvoie vers la messagerie : le support se lit
 * au même endroit et sous la même forme que les autres conversations.
 */
export default async function SupportThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/support/${id}`);

  // Discussion d'un autre compte : introuvable, pas « interdit ». Répondre
  // « interdit » confirmerait qu'elle existe.
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!ticket) notFound();

  redirect(`/messages/support?t=${ticket.id}`);
}

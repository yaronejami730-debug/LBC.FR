import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ChatWindow from "./ChatWindow";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      listing: { select: { id: true, title: true, price: true, images: true } },
      participants: {
        include: { user: { select: { id: true, name: true, avatar: true, verified: true } } },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { sender: { select: { id: true, name: true, avatar: true } } },
      },
    },
  });

  if (!conversation) notFound();

  const isParticipant = conversation.participants.some(
    (p) => p.userId === userId
  );
  if (!isParticipant) redirect("/messages");

  // Mark messages as read
  await prisma.message.updateMany({
    where: {
      conversationId: id,
      senderId: { not: userId },
      read: false,
    },
    data: { read: true },
  });

  const otherParticipant = conversation.participants.find(
    (p) => p.userId !== userId
  );
  const listingImages = JSON.parse(conversation.listing.images) as string[];

  return (
    <ChatWindow
      conversationId={id}
      currentUserId={userId}
      otherUser={otherParticipant?.user ?? null}
      listing={{
        id: conversation.listing.id,
        title: conversation.listing.title,
        price: conversation.listing.price,
        image: listingImages[0] || null,
      }}
      initialMessages={conversation.messages.map((m) => ({
        id: m.id,
        content: m.content,
        senderId: m.senderId,
        senderName: m.sender.name,
        senderAvatar: m.sender.avatar,
        createdAt: m.createdAt.toISOString(),
      }))}
    />
  );
}

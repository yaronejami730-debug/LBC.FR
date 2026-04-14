import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/sse";
import { sendEmail } from "@/lib/email";
import { newMessageEmail } from "@/lib/emails/new-message";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");
  const afterId = searchParams.get("after");

  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  }

  // Verify participant
  const participant = await prisma.conversationParticipant.findUnique({
    where: { userId_conversationId: { userId, conversationId } },
  });
  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Cursor-based pagination by ID — no createdAt race condition
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    ...(afterId ? { cursor: { id: afterId }, skip: 1 } : {}),
    include: { sender: { select: { id: true, name: true, avatar: true } } },
  });

  // Mark newly fetched messages from others as read
  if (messages.length > 0) {
    const unreadIds = messages
      .filter((m) => m.senderId !== userId && !m.read)
      .map((m) => m.id);
    if (unreadIds.length > 0) {
      await prisma.message.updateMany({
        where: { id: { in: unreadIds } },
        data: { read: true },
      });
    }
  }

  return NextResponse.json(
    messages.map((m) => ({
      id: m.id,
      content: m.content,
      senderId: m.senderId,
      senderName: m.sender.name,
      senderAvatar: m.sender.avatar,
      createdAt: m.createdAt.toISOString(),
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId, content } = await req.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  // Verify participant
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      userId_conversationId: {
        userId: session.user.id,
        conversationId,
      },
    },
  });
  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const message = await prisma.message.create({
    data: {
      content: content.trim(),
      senderId: session.user.id,
      conversationId,
    },
    include: {
      sender: { select: { id: true, name: true, avatar: true } },
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  const payload = {
    id: message.id,
    content: message.content,
    senderId: message.senderId,
    senderName: message.sender.name,
    senderAvatar: message.sender.avatar,
    createdAt: message.createdAt.toISOString(),
  };

  broadcast(conversationId, payload);

  // Notifier l'autre participant par email — fire and forget
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      listing: { select: { title: true, id: true } },
      participants: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  if (conversation) {
    const recipient = conversation.participants.find(
      (p) => p.userId !== session.user.id
    );
    if (recipient) {
      const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
      sendEmail({
        to: recipient.user.email,
        toName: recipient.user.name,
        subject: `Nouveau message de ${message.sender.name} — Deal & Co`,
        html: newMessageEmail({
          name: recipient.user.name,
          senderName: message.sender.name,
          listingTitle: conversation.listing.title,
          messageBody: message.content,
          conversationUrl: `${baseUrl}/messages/${conversationId}`,
        }),
      }).catch(() => {});
    }
  }

  return NextResponse.json(payload, { status: 201 });
}

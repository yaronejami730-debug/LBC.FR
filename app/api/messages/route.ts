import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/sse";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");
  const afterId = searchParams.get("after"); // last known message ID

  if (!conversationId) {
    return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });
  }

  // Verify participant
  const participant = await prisma.conversationParticipant.findUnique({
    where: { userId_conversationId: { userId: session.user.id, conversationId } },
  });
  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch messages newer than the last known one
  let createdAfter: Date | undefined;
  if (afterId) {
    const ref = await prisma.message.findUnique({ where: { id: afterId }, select: { createdAt: true } });
    if (ref) createdAfter = ref.createdAt;
  }

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      ...(createdAfter ? { createdAt: { gt: createdAfter } } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { id: true, name: true, avatar: true } } },
  });

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

  // Verify user is a participant
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

  // Update conversation updatedAt
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

  // Broadcast to SSE listeners
  broadcast(conversationId, payload);

  return NextResponse.json(payload, { status: 201 });
}

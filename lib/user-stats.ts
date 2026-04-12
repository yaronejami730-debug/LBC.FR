import { prisma } from "./prisma";

export async function getUserResponseTime(userId: string): Promise<string | null> {
  // Find conversations involving this user
  const participants = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: { conversationId: true },
  });

  const conversationIds = participants.map((p) => p.conversationId);
  if (conversationIds.length === 0) return null;

  const conversations = await prisma.conversation.findMany({
    where: { id: { in: conversationIds } },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  let totalDiff = 0;
  let count = 0;

  for (const conv of conversations) {
    for (let i = 0; i < conv.messages.length - 1; i++) {
      const msg = conv.messages[i];
      const nextMsg = conv.messages[i + 1];

      // If current message is NOT from our user, and next message IS from our user
      if (msg.senderId !== userId && nextMsg.senderId === userId) {
        const diff = nextMsg.createdAt.getTime() - msg.createdAt.getTime();
        totalDiff += diff;
        count++;
      }
    }
  }

  if (count === 0) return null;

  const avgMs = totalDiff / count;
  const avgMins = Math.round(avgMs / 60000);

  if (avgMins < 1) return "< 1 min";
  if (avgMins < 60) return `${avgMins} mins`;
  
  const hours = Math.floor(avgMins / 60);
  if (hours < 24) return `${hours} h`;
  
  return "Quelques jours";
}

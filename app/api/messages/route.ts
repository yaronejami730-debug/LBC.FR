import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/auth-unified";
import { sendPushNotification } from "@/lib/notifications/send";
import { broadcast } from "@/lib/sse";
import { sendEmail } from "@/lib/email";
import { newMessageEmail } from "@/lib/emails/new-message";
import { rateLimit } from "@/lib/rate-limit";
import { scanScam } from "@/lib/moderation/scam-patterns";
import { scanText } from "@/lib/moderation/url-scanner";
import { ensureBlacklistPrimed } from "@/lib/moderation/blacklist";
import { aggregateRisk, signal } from "@/lib/moderation/risk-engine";
import { computeTrustScore } from "@/lib/trust-score";

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      flagged: (m as any).flagged ?? false,
      attachmentUrl: (m as any).attachmentUrl ?? null,
      attachmentType: (m as any).attachmentType ?? null,
      attachmentName: (m as any).attachmentName ?? null,
    }))
  );
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const session = { user: { id: userId } } as { user: { id: string } };

  const { conversationId, content, attachmentUrl, attachmentType, attachmentName } = await req.json();

  const hasAttachment =
    typeof attachmentUrl === "string" &&
    attachmentUrl.length > 0 &&
    (attachmentType === "image" || attachmentType === "pdf");

  if (!content?.trim() && !hasAttachment) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  if (content && (typeof content !== "string" || content.trim().length > 5_000)) {
    return NextResponse.json({ error: "Message trop long (max 5000 caractères)" }, { status: 400 });
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

  // ── Vélocité — anti-bot / anti-spam (30 messages / minute) ──
  // En mémoire : suffisant en mono-instance ; passer sur Redis si scale-out.
  if (!rateLimit(`msg:${session.user.id}`, 30, 60_000)) {
    return NextResponse.json(
      { error: "Trop de messages envoyés. Patientez une minute." },
      { status: 429 },
    );
  }

  // ── Modération du message — scam + phishing ──
  // Seuils abaissés vs annonces : le scam vit dans la messagerie.
  const text = (content ?? "").trim();
  await ensureBlacklistPrimed(prisma);
  const scamReport = scanScam(text);
  const urlReport = scanText(text);
  const riskHits = scamReport.hits.map((h) =>
    signal(h.patternId, h.category === "phishing" ? "phishing" : "scam", h.score, {
      match: h.match,
    }),
  );
  if (urlReport.worst) {
    riskHits.push(
      signal("url.suspect", "phishing", urlReport.totalScore, { host: urlReport.worst.host }),
    );
  }
  const trust = await computeTrustScore({ userId: session.user.id as string });
  const risk = aggregateRisk(riskHits, trust.score, { shadow: 25, review: 45, block: 70 });
  // Le message est toujours livré (un blocage dur sur faux positif nuit plus
  // qu'il ne protège), mais signalé : la file admin et le destinataire alertés.
  const flagged = risk.decision === "review" || risk.decision === "block";

  const message = await prisma.message.create({
    data: {
      content: text,
      senderId: session.user.id,
      conversationId,
      riskScore: risk.riskScore,
      flagged,
      flagReason: flagged ? risk.topSignals.join(", ") : null,
      attachmentUrl: hasAttachment ? attachmentUrl : null,
      attachmentType: hasAttachment ? attachmentType : null,
      attachmentName: hasAttachment ? (typeof attachmentName === "string" ? attachmentName.slice(0, 200) : null) : null,
    } as any,
    include: {
      sender: { select: { id: true, name: true, avatar: true } },
    },
  });

  if (flagged) {
    prisma.moderationEvent.create({
      data: {
        userId: session.user.id,
        actor: "system",
        action: "message_flagged",
        reason: `risk=${risk.riskScore}(${risk.decision}) conv=${conversationId} msg=${message.id}`,
        scoreAfter: risk.riskScore,
      } as any,
    }).catch(() => {});
  }

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
    flagged,
    attachmentUrl: (message as any).attachmentUrl ?? null,
    attachmentType: (message as any).attachmentType ?? null,
    attachmentName: (message as any).attachmentName ?? null,
  };

  broadcast(conversationId, payload);

  // Notifier l'autre participant par email — fire and forget.
  // Sauté si le message est signalé : ne pas relayer du phishing par email.
  const conversation = flagged
    ? null
    : await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      listing: { select: { title: true, id: true } },
      participants: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  // Push notif Expo — fire and forget. Indépendant de l'email.
  // Sauté aussi si le message est signalé (phishing potentiel).
  if (!flagged) {
    prisma.conversation
      .findUnique({
        where: { id: conversationId },
        include: {
          listing: { select: { id: true, title: true, userId: true } },
          participants: { select: { userId: true } },
        },
      })
      .then((conv) => {
        if (!conv) return;
        const targets = conv.participants
          .map((p) => p.userId)
          .filter((id) => id !== session.user.id);
        const senderName = message.sender.name ?? "Quelqu'un";
        return Promise.all(
          targets.map((uid) => {
            // Si la cible est le vendeur de l'annonce : template "intérêt sur annonce".
            const isOwner = uid === conv.listing.userId;
            return sendPushNotification({
              userId: uid,
              template: isOwner ? "listing_message" : "new_message",
              variables: {
                senderName,
                listingTitle: conv.listing.title,
                listingId: conv.listing.id,
                conversationId,
              },
            });
          }),
        );
      })
      .catch(() => {});
  }

  if (conversation) {
    const senderId = session.user?.id;
    const recipient = conversation.participants.find(
      (p) => p.userId !== senderId
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
          messageBody: message.content || (attachmentType === "pdf" ? "Document PDF" : "Photo"),
          conversationUrl: `${baseUrl}/messages/${conversationId}`,
        }),
      }).catch(() => { });
    }
  }

  return NextResponse.json(payload, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { generateLoginId, generateTempPassword } from "@/lib/pro-member-auth";
import { sendEmail } from "@/lib/email";
import { memberAccessEmail } from "@/lib/emails/member-access";

export const runtime = "nodejs";

/**
 * Génération et retrait de l'accès personnel d'un membre d'équipe.
 *
 * Réservé au propriétaire de la fiche : c'est la responsable du salon qui
 * distribue les accès, le salarié ne s'inscrit pas. Le mot de passe n'est
 * renvoyé **qu'une fois**, à la génération — ensuite seul son empreinte existe.
 * Perdu, il se régénère ; il ne se relit pas.
 */

/** Vérifie que le membre appartient bien à la fiche du compte connecté. */
async function ownedMember(userId: string, memberId: string) {
  return prisma.proMember.findFirst({
    where: { id: memberId, profile: { userId } },
    select: {
      id: true,
      displayName: true,
      loginId: true,
      email: true,
      profile: { select: { name: true } },
    },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function loginUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}/equipe/connexion`;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const member = await ownedMember(session.user.id, id);
  if (!member) return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });

  // L'identifiant ne change pas à la régénération : le membre l'a noté, et le
  // renouveler à chaque oubli de mot de passe créerait plus d'appels qu'il n'en
  // éviterait. Seul le mot de passe est renouvelé.
  let loginId = member.loginId;
  if (!loginId) {
    for (let i = 0; i < 5; i++) {
      const candidate = generateLoginId(member.displayName);
      const taken = await prisma.proMember.findUnique({
        where: { loginId: candidate },
        select: { id: true },
      });
      if (!taken) {
        loginId = candidate;
        break;
      }
    }
    if (!loginId) {
      return NextResponse.json({ error: "Génération impossible, réessayez" }, { status: 500 });
    }
  }

  // Adresse d'envoi : celle qu'on vient de saisir, sinon la dernière connue.
  // Elle est mémorisée pour que renvoyer un accès ne demande pas de la
  // ressaisir six mois plus tard.
  const body = (await req.json().catch(() => ({}))) as { email?: unknown };
  const typed = String(body.email ?? "").trim().toLowerCase();
  if (typed && !EMAIL_RE.test(typed)) {
    return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  }
  const recipient = typed || member.email || null;

  const password = generateTempPassword();
  await prisma.proMember.update({
    where: { id: member.id },
    data: {
      loginId,
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePassword: true,
      accessRevokedAt: null,
      ...(typed ? { email: typed } : {}),
    },
  });

  // L'envoi ne conditionne pas la génération : si la boîte du salarié rebondit,
  // l'accès existe quand même et reste affiché à l'écran pour être recopié.
  let sentTo: string | null = null;
  if (recipient) {
    try {
      await sendEmail({
        to: recipient,
        toName: member.displayName,
        subject: `Votre accès au planning — ${member.profile.name}`,
        html: memberAccessEmail({
          displayName: member.displayName,
          proName: member.profile.name,
          loginId,
          password,
          loginUrl: loginUrl(),
        }),
        adSource: "admin-member-access",
      });
      sentTo = recipient;
    } catch (e) {
      console.error("[members/credentials] envoi impossible", e);
    }
  }

  return NextResponse.json({
    loginId,
    // Seule et unique fois où il transite en clair.
    password,
    loginUrl: loginUrl(),
    email: recipient,
    sentTo,
    notice: sentTo
      ? `Accès envoyé à ${sentTo}. Notez-les quand même : le mot de passe ne sera plus affiché.`
      : "Notez ce mot de passe : il ne sera plus affiché. Le membre devra le changer à sa première connexion.",
  });
}

/** Coupe l'accès sans supprimer le membre — les rendez-vous passés restent. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const member = await ownedMember(session.user.id, id);
  if (!member) return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });

  await prisma.proMember.update({
    where: { id: member.id },
    data: { accessRevokedAt: new Date(), passwordHash: null },
  });

  return NextResponse.json({ ok: true });
}

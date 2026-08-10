import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { generateLoginId, generateTempPassword } from "@/lib/pro-member-auth";

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
    select: { id: true, displayName: true, loginId: true },
  });
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

  const password = generateTempPassword();
  await prisma.proMember.update({
    where: { id: member.id },
    data: {
      loginId,
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePassword: true,
      accessRevokedAt: null,
    },
  });

  return NextResponse.json({
    loginId,
    // Seule et unique fois où il transite en clair.
    password,
    notice:
      "Notez ce mot de passe : il ne sera plus affiché. Le membre devra le changer à sa première connexion.",
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

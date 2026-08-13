import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ProAccessError,
  canManageEstablishments,
  canManageCompany,
  resolveProScope,
  type ProRole,
} from "@/lib/pro/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES: ProRole[] = ["OWNER", "ADMIN", "MANAGER"];

/**
 * Qui administre l'entreprise.
 *
 * À ne pas confondre avec `ProMember`, l'équipe qu'on planifie : ici ce sont
 * des comptes Deal&Co qui entrent dans le back-office — voir l'agenda, éditer
 * la fiche, encaisser. Un salon qui confie sa gestion à un associé n'a
 * jusqu'ici aucun moyen de le retirer : la ligne d'accès se créait à
 * l'inscription et vivait pour toujours.
 */
export async function GET(req: NextRequest) {
  try {
    const scope = await resolveProScope(req);
    const companyId = scope.establishment.companyId;
    if (!companyId) {
      // Fiche antérieure au multi-établissement : son créateur est seul maître
      // à bord, il n'y a pas d'entreprise à partager.
      return NextResponse.json({ companyId: null, access: [], canManage: false });
    }

    const rows = await prisma.proAccess.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true, lastLoginAt: true } },
      },
    });

    return NextResponse.json({
      companyId,
      canManage: canManageEstablishments(scope.role),
      canManageOwners: canManageCompany(scope.role),
      me: scope.userId,
      access: rows.map((a) => ({
        id: a.id,
        role: a.role,
        createdAt: a.createdAt,
        establishmentIds: parseIds(a.establishmentIds),
        user: a.user,
      })),
      establishments: scope.establishments.map((e) => ({ id: e.id, name: e.name, city: e.city })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Invite un compte existant à administrer l'entreprise.
 *
 * Le compte doit déjà exister : créer un compte à la place de quelqu'un
 * reviendrait à choisir son mot de passe. L'associé s'inscrit normalement, puis
 * on l'ajoute par son email.
 */
export async function POST(req: NextRequest) {
  try {
    const scope = await resolveProScope(req);
    if (!canManageEstablishments(scope.role)) {
      throw new ProAccessError(
        "Seul un propriétaire ou un administrateur peut donner un accès.",
        403,
        "FORBIDDEN",
      );
    }

    const companyId = scope.establishment.companyId;
    if (!companyId) throw new ProAccessError("Entreprise introuvable.", 409, "NO_COMPANY");

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = String(body.role ?? "MANAGER") as ProRole;
    if (!email) throw new ProAccessError("Email requis.", 400, "MISSING_EMAIL");
    if (!ROLES.includes(role)) throw new ProAccessError("Rôle inconnu.", 400, "BAD_ROLE");
    // Nommer un propriétaire donne accès au légal et à la facturation : seul un
    // propriétaire peut le faire.
    if (role === "OWNER" && !canManageCompany(scope.role)) {
      throw new ProAccessError(
        "Seul un propriétaire peut nommer un autre propriétaire.",
        403,
        "FORBIDDEN",
      );
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      throw new ProAccessError(
        "Aucun compte Deal&Co avec cet email. La personne doit d'abord s'inscrire.",
        404,
        "NO_USER",
      );
    }

    const establishmentIds =
      role === "MANAGER" && Array.isArray(body.establishmentIds)
        ? body.establishmentIds.map(String).filter((id) => scope.establishments.some((e) => e.id === id))
        : [];

    const access = await prisma.proAccess.upsert({
      where: { userId_companyId: { userId: user.id, companyId } },
      update: { role, establishmentIds: JSON.stringify(establishmentIds) },
      create: {
        userId: user.id,
        companyId,
        role,
        establishmentIds: JSON.stringify(establishmentIds),
      },
      include: { user: { select: { id: true, name: true, email: true, avatar: true, lastLoginAt: true } } },
    });

    return NextResponse.json(
      {
        access: {
          id: access.id,
          role: access.role,
          createdAt: access.createdAt,
          establishmentIds,
          user: access.user,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Retire un accès.
 *
 * Deux garde-fous : on ne retire pas le sien (plus personne ne pourrait
 * rouvrir la boutique), et on ne laisse jamais l'entreprise sans propriétaire.
 */
export async function DELETE(req: NextRequest) {
  try {
    const scope = await resolveProScope(req);
    if (!canManageEstablishments(scope.role)) {
      throw new ProAccessError("Seul un responsable peut retirer un accès.", 403, "FORBIDDEN");
    }

    const id = new URL(req.url).searchParams.get("id");
    if (!id) throw new ProAccessError("Identifiant requis.", 400, "MISSING_ID");

    const target = await prisma.proAccess.findUnique({ where: { id } });
    if (!target || target.companyId !== scope.establishment.companyId) {
      throw new ProAccessError("Accès introuvable.", 404, "NOT_FOUND");
    }
    if (target.userId === scope.userId) {
      throw new ProAccessError("Impossible de retirer son propre accès.", 409, "SELF");
    }
    if (target.role === "OWNER") {
      if (!canManageCompany(scope.role)) {
        throw new ProAccessError(
          "Seul un propriétaire peut retirer un autre propriétaire.",
          403,
          "FORBIDDEN",
        );
      }
      const owners = await prisma.proAccess.count({
        where: { companyId: target.companyId, role: "OWNER" },
      });
      if (owners <= 1) {
        throw new ProAccessError(
          "L'entreprise doit garder au moins un propriétaire.",
          409,
          "LAST_OWNER",
        );
      }
    }

    await prisma.proAccess.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}

function parseIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function errorResponse(error: unknown) {
  if (error instanceof ProAccessError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error("[pro] accès", error);
  return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
}

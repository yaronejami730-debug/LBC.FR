"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SECTION_KEYS } from "@/lib/admin/sections";

/**
 * Gestion des équipes internes.
 *
 * Deux garde-fous traversent ce fichier, et ils protègent la même chose :
 * qu'on ne se retire pas soi-même la clé de la maison.
 *
 *  - une équipe qui détient `"*"` ne peut pas perdre son dernier membre ;
 *  - on ne peut pas quitter la dernière équipe à accès complet dont on fait
 *    partie.
 *
 * Sans eux, une manipulation ordinaire un vendredi soir ferme l'administration
 * à tout le monde, et la seule issue est une requête SQL à la main.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<string> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || role !== "ADMIN") throw new Error("Accès refusé");
  return session.user.id as string;
}

async function guard(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Action impossible" };
  }
}

/** Identifiant stable dérivé du libellé. */
function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function createTeam(label: string, description: string): Promise<ActionResult> {
  return guard(async () => {
    await requireAdmin();
    const name = label.trim();
    if (name.length < 2) throw new Error("Donnez un nom à l'équipe");

    const slug = slugify(name);
    if (!slug) throw new Error("Ce nom ne produit pas d'identifiant valide");

    const existing = await prisma.staffTeam.findUnique({ where: { slug }, select: { id: true } });
    if (existing) throw new Error("Une équipe porte déjà ce nom");

    await prisma.staffTeam.create({
      data: {
        slug,
        label: name.slice(0, 80),
        description: description.trim().slice(0, 200) || null,
        // Aucun droit au départ : on ouvre les sections ensuite, en connaissance
        // de cause. Une équipe créée avec tout serait la porte ouverte à
        // l'accès complet par inadvertance.
        sections: "[]",
      },
    });
    revalidatePath("/admin/equipes");
  });
}

export async function setTeamSections(teamId: string, sections: string[]): Promise<ActionResult> {
  return guard(async () => {
    await requireAdmin();

    const clean = sections.filter((s) => s === "*" || SECTION_KEYS.includes(s));

    const team = await prisma.staffTeam.findUnique({
      where: { id: teamId },
      select: { sections: true, _count: { select: { members: true } } },
    });
    if (!team) throw new Error("Équipe introuvable");

    // Retirer l'accès complet d'une équipe qui en est la dernière détentrice
    // reviendrait à verrouiller l'administration.
    const hadFull = team.sections.includes('"*"');
    if (hadFull && !clean.includes("*")) {
      const others = await prisma.staffTeam.count({
        where: { id: { not: teamId }, sections: { contains: '"*"' }, members: { some: {} } },
      });
      if (others === 0 && team._count.members > 0) {
        throw new Error(
          "C'est la dernière équipe à accès complet. Donnez cet accès à une autre équipe d'abord.",
        );
      }
    }

    await prisma.staffTeam.update({
      where: { id: teamId },
      data: { sections: JSON.stringify(clean) },
    });
    revalidatePath("/admin/equipes");
  });
}

export async function addMember(teamId: string, email: string): Promise<ActionResult> {
  return guard(async () => {
    const adminId = await requireAdmin();
    const address = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: address },
      select: { id: true, role: true },
    });
    if (!user) throw new Error("Aucun compte avec cette adresse. La personne doit s'inscrire d'abord.");

    // Entrer dans une équipe suppose de pouvoir entrer dans l'administration :
    // les deux vont ensemble, autant l'accorder ici que laisser un membre
    // d'équipe buter sur la page de connexion.
    if (user.role !== "ADMIN") {
      await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    }

    await prisma.staffMembership.upsert({
      where: { userId_teamId: { userId: user.id, teamId } },
      update: {},
      create: { userId: user.id, teamId, grantedBy: adminId },
    });
    revalidatePath("/admin/equipes");
  });
}

export async function removeMember(teamId: string, userId: string): Promise<ActionResult> {
  return guard(async () => {
    const adminId = await requireAdmin();

    const team = await prisma.staffTeam.findUnique({
      where: { id: teamId },
      select: { sections: true, _count: { select: { members: true } } },
    });
    if (!team) throw new Error("Équipe introuvable");

    const isFull = team.sections.includes('"*"');
    if (isFull && team._count.members === 1) {
      throw new Error("Dernier membre d'une équipe à accès complet : ajoutez quelqu'un d'abord.");
    }
    if (isFull && userId === adminId) {
      const otherFull = await prisma.staffMembership.count({
        where: { userId: adminId, teamId: { not: teamId }, team: { sections: { contains: '"*"' } } },
      });
      if (otherFull === 0) {
        throw new Error("Vous perdriez votre propre accès complet. Faites-le faire par quelqu'un d'autre.");
      }
    }

    await prisma.staffMembership.deleteMany({ where: { teamId, userId } });
    revalidatePath("/admin/equipes");
  });
}

/**
 * Supprime une équipe.
 *
 * Les appartenances tombent avec (cascade). Le compte lui-même n'est pas
 * touché : quelqu'un retiré d'une équipe reste inscrit sur le site.
 */
export async function deleteTeam(teamId: string): Promise<ActionResult> {
  return guard(async () => {
    await requireAdmin();
    const team = await prisma.staffTeam.findUnique({
      where: { id: teamId },
      select: { sections: true },
    });
    if (!team) throw new Error("Équipe introuvable");

    if (team.sections.includes('"*"')) {
      const others = await prisma.staffTeam.count({
        where: { id: { not: teamId }, sections: { contains: '"*"' }, members: { some: {} } },
      });
      if (others === 0) throw new Error("C'est la dernière équipe à accès complet.");
    }

    await prisma.staffTeam.delete({ where: { id: teamId } });
    revalidatePath("/admin/equipes");
  });
}

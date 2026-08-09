import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendEmail } from "@/lib/email";
import { verifyEmail } from "@/lib/emails/verify-email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import {
  checkBanRegistry,
  releaseSiretFromBannedAccounts,
  BAN_BLOCK_MESSAGE,
} from "@/lib/moderation/ban-registry";

export async function POST(req: NextRequest) {
  try {
  const ip = getClientIp(req);
  if (!rateLimit(`register:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, { status: 429 });
  }

  const { name, email, password, isPro, siret, companyName, marketingConsent } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  }

  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères" }, { status: 400 });
  }

  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
    return NextResponse.json({ error: "Nom invalide" }, { status: 400 });
  }

  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  // Réinscription après bannissement. Le registre ne contient que des
  // empreintes : on compare des hachages, jamais des valeurs en clair.
  // Le message renvoyé est volontairement identique quel que soit le signal
  // qui a déclenché le blocage — préciser « votre numéro est banni » revient à
  // indiquer quoi changer pour passer au travers.
  //
  // Le SIRET n'entre pas dans ce contrôle : il n'appartient pas au fraudeur
  // qui l'a recopié, et le bloquer fermerait la porte à l'entreprise usurpée.
  const ban = await checkBanRegistry({ email, phone: null }).catch(() => ({
    blocked: false,
    matchedOn: null as null,
  }));
  if (ban.blocked) {
    console.warn(`[REGISTER] inscription refusée (registre: ${ban.matchedOn})`);
    return NextResponse.json({ error: BAN_BLOCK_MESSAGE }, { status: 403 });
  }

  if (isPro && siret) {
    // Un SIRET retenu par un compte banni est relâché : c'est un identifiant
    // public, et l'usurpateur n'a aucun titre à en priver l'entreprise réelle.
    await releaseSiretFromBannedAccounts(siret).catch((err) =>
      console.error("[REGISTER] libération SIRET:", err),
    );

    const siretUsed = await prisma.user.findUnique({ where: { siret } });
    if (siretUsed) {
      return NextResponse.json({ error: "Ce SIRET est déjà associé à un compte" }, { status: 409 });
    }
  }

  const earlyAdopter = await prisma.earlyAdopter.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      memberSince: new Date().getFullYear(),
      consentGivenAt: new Date(),
      marketingConsent: marketingConsent === true,
      // Inscription pro : le SIRET et la raison sociale sont enregistrés, mais
      // `isPro` reste faux. Le badge professionnel s'obtient après dépôt d'une
      // pièce d'identité et d'un Kbis, validés dans /admin/verifications-pro —
      // sinon il suffisait de recopier le SIRET d'une autre entreprise.
      ...(isPro && siret && companyName ? { siret, companyName } : {}),
      ...(earlyAdopter ? { earlyAdopterDiscount: true } : {}),
    },
  });

  if (earlyAdopter && !earlyAdopter.claimedAt) {
    prisma.earlyAdopter.update({
      where: { id: earlyAdopter.id },
      data: { claimedAt: new Date(), userId: user.id },
    }).catch(() => {});
  }

  const token = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.emailVerificationToken.create({ data: { userId: user.id, token, expiresAt } });

  const displayName = user.isPro ? user.companyName ?? user.name : user.name;

  sendEmail({
    to: user.email,
    toName: displayName,
    subject: "Confirmez votre adresse email — Deal & Co",
    html: verifyEmail({ name: displayName, code: token }),
  }).catch((err) => console.error("[REGISTER] sendEmail failed:", err?.message ?? err));

  return NextResponse.json({ id: user.id, pendingVerification: true }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/register]", err);
    const message = err instanceof Error ? err.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

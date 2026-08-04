/**
 * Dépôt d'une demande annonceur depuis la page d'accueil.
 *
 * Route publique et non authentifiée : le prospect ne crée pas de compte. Elle
 * est donc limitée en débit et ne renvoie jamais d'information sur les
 * demandes existantes.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { isAdvertiserBudget } from "@/lib/advertiser-budgets";
import { advertiserLeadAdminEmail } from "@/lib/emails/advertiser-lead-admin";
import { advertiserLeadConfirmationEmail } from "@/lib/emails/advertiser-lead-confirmation";

const BASE = process.env.NEXTAUTH_URL ?? "https://www.dealandcompany.fr";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

const MAX_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

/** Longueurs maximales — protège la base et l'affichage admin. */
const LIMITS = { name: 80, email: 160, phone: 30, company: 120, message: 1000 } as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Numéro français ou international, saisi avec ou sans espaces et séparateurs. */
const PHONE_RE = /^\+?[\d\s.\-()]{9,20}$/;

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!rateLimit(`advertiser-lead:${ip}`, MAX_PER_HOUR, HOUR_MS)) {
    return NextResponse.json(
      { error: "Trop de demandes envoyées. Réessayez dans une heure." },
      { status: 429 },
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const firstName = clean(payload.firstName, LIMITS.name);
  const lastName = clean(payload.lastName, LIMITS.name);
  const email = clean(payload.email, LIMITS.email).toLowerCase();
  const phone = clean(payload.phone, LIMITS.phone);
  const company = clean(payload.company, LIMITS.company) || null;
  const message = clean(payload.message, LIMITS.message) || null;
  const budget = payload.budget;
  const source = clean(payload.source, 60) || null;

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "Nom et prénom sont requis" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
  }
  if (!PHONE_RE.test(phone)) {
    return NextResponse.json({ error: "Numéro de téléphone invalide" }, { status: 400 });
  }
  if (!isAdvertiserBudget(budget)) {
    return NextResponse.json({ error: "Budget invalide" }, { status: 400 });
  }

  // Un même email qui redépose dans l'heure ne crée pas de doublon dans le
  // pipeline commercial — on répond comme si de rien n'était.
  const recent = await prisma.advertiserLead.findFirst({
    where: { email, createdAt: { gte: new Date(Date.now() - HOUR_MS) } },
    select: { id: true },
  });
  if (recent) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const lead = await prisma.advertiserLead.create({
    data: {
      firstName,
      lastName,
      email,
      phone,
      budget,
      company,
      message,
      source,
      ip,
      userAgent: req.headers.get("user-agent")?.slice(0, 255) ?? null,
    },
  });

  // Envois best-effort : une panne Brevo ne doit pas perdre le lead, il est
  // déjà en base et visible dans l'administration.
  if (ADMIN_EMAIL) {
    sendEmail({
      to: ADMIN_EMAIL,
      subject: `📣 Demande annonceur — ${firstName} ${lastName}`,
      adSource: "admin-advertiser-lead",
      html: advertiserLeadAdminEmail({
        firstName,
        lastName,
        email,
        phone,
        budget,
        company,
        message,
        source,
        adminUrl: `${BASE}/admin/annonceurs`,
      }),
    }).catch(() => {});
  }

  sendEmail({
    to: email,
    toName: firstName,
    subject: "Votre demande est bien reçue — Deal & Co",
    html: advertiserLeadConfirmationEmail({ firstName, phone }),
  }).catch(() => {});

  return NextResponse.json({ ok: true, id: lead.id });
}

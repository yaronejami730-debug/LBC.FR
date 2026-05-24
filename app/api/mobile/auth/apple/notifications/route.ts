import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { prisma } from "@/lib/prisma";

const APPLE_BUNDLE_ID = "fr.dealandcompany.app";
const APPLE_ISSUER = "https://appleid.apple.com";
const JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

type AppleEventType =
  | "email-disabled"
  | "email-enabled"
  | "consent-revoked"
  | "account-delete";

type AppleEventPayload = {
  sub?: string;
  email?: string;
  is_private_email?: string | boolean;
  events?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { payload: outerPayload } = await req.json().then((b) => {
      return { payload: b as { payload?: string } };
    });

    const signedToken = outerPayload.payload;
    if (!signedToken || typeof signedToken !== "string") {
      return NextResponse.json({ error: "payload manquant" }, { status: 400 });
    }

    const { payload } = await jwtVerify(signedToken, JWKS, {
      issuer: APPLE_ISSUER,
      audience: APPLE_BUNDLE_ID,
    });

    const eventsRaw = (payload as { events?: string }).events;
    if (!eventsRaw) return NextResponse.json({ ok: true });

    const events = JSON.parse(eventsRaw) as AppleEventPayload & { type?: AppleEventType };
    const appleSub = events.sub;
    if (!appleSub) return NextResponse.json({ ok: true });

    const email = events.email?.toLowerCase();
    const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
    if (!user) return NextResponse.json({ ok: true });

    switch (events.type) {
      case "account-delete":
      case "consent-revoked":
        await prisma.user.update({
          where: { id: user.id },
          data: { bannedAt: new Date(), banReason: `Apple ${events.type}` },
        });
        break;
      case "email-disabled":
      case "email-enabled":
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[apple notifications]", err);
    return NextResponse.json({ ok: true });
  }
}

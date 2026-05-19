/** Clé publique VAPID — exposée au navigateur pour souscrire. */
import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/push";

export async function GET() {
  const key = getVapidPublicKey();
  if (!key) return NextResponse.json({ key: null }, { status: 200 });
  return NextResponse.json({ key });
}

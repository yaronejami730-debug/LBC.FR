import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.AUTH_SECRET;
if (!SECRET) throw new Error("AUTH_SECRET missing");

function b64url(buf: Buffer | string) {
  return Buffer.from(buf).toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", SECRET!).update(payload).digest("base64url");
}

/**
 * Signed token for email-preferences page. Format: `<userId>.<exp>.<sig>`.
 * `exp` is a UNIX seconds timestamp; default lifetime 90 days.
 */
export function createEmailPrefToken(userId: string, lifetimeDays = 90) {
  const exp = Math.floor(Date.now() / 1000) + lifetimeDays * 86_400;
  const payload = `${b64url(userId)}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyEmailPrefToken(token: string): { userId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [uidB64, expStr, sig] = parts;
  const payload = `${uidB64}.${expStr}`;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  try {
    return { userId: Buffer.from(uidB64, "base64url").toString("utf8") };
  } catch {
    return null;
  }
}

export function emailPrefUrl(userId: string, baseUrl = "https://www.dealandcompany.fr") {
  return `${baseUrl}/preferences/email?token=${createEmailPrefToken(userId)}`;
}

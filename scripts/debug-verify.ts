import { config } from "dotenv";
config({ path: ".env.local" });
import { SignJWT, jwtVerify } from "jose";

const ISSUER = "dealandco-mobile";
const AUDIENCE = "dealandco-mobile-app";

(async () => {
  const raw = process.env.AUTH_SECRET ?? "";
  console.log("AUTH_SECRET length:", raw.length);
  console.log("first/last char codes:", raw.charCodeAt(0), raw.charCodeAt(raw.length - 1));
  const secret = new TextEncoder().encode(raw);

  const token = process.argv[2];
  if (!token) {
    console.error("usage: debug-verify <token>");
    process.exit(1);
  }

  try {
    const { payload } = await jwtVerify(token, secret, { issuer: ISSUER, audience: AUDIENCE });
    console.log("VERIFY OK", payload);
  } catch (e) {
    console.error("VERIFY FAIL", (e as Error).message, (e as Error).name);
  }
  process.exit(0);
})();

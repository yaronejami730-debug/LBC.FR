import { prisma } from "@/lib/prisma";
(async () => {
  const t = await prisma.expoPushToken.findFirst({ where: { disabledAt: null }, select: { token: true } });
  if (!t) { console.log("no token"); process.exit(0); }
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify([{ to: t.token, title: "Test Deal&Co", body: "Notification de test", sound: "default" }]),
  });
  console.log("status", res.status);
  console.log(await res.text());
  process.exit(0);
})();

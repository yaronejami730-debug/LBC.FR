import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { isEmailAllowed } from "@/lib/notifications/preferences";
import { baseEmail } from "@/lib/emails/base";
import { listingUrl } from "@/lib/listing-slug";

export const runtime = "nodejs";
export const maxDuration = 300;

const BASE = "https://www.dealandcompany.fr";
/** Fenêtre d'attente : laisse le temps à un vendeur de publier sa série. */
const QUIET_MINUTES = 45;

/**
 * Notification des abonnés — un seul email, même pour dix annonces.
 *
 * Un vendeur publie rarement une annonce isolée : il vide un garage, il met en
 * ligne son stock. Envoyer un email par annonce ferait fuir l'abonné. Ce cron
 * passe régulièrement, regroupe tout ce qui a été publié depuis la dernière
 * notification de chaque abonnement, et n'envoie qu'un message par abonné —
 * toutes chaînes suivies confondues.
 *
 * `lastNotifiedAt` avance seulement après un envoi réussi : rien n'est perdu si
 * l'email échoue.
 */
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expected = process.env.CRON_SECRET;
  if (!expected || (secret !== expected && bearer !== expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // On ignore les annonces des dernières minutes : le vendeur est peut-être en
  // train d'en publier d'autres, autant les regrouper.
  const settled = new Date(now.getTime() - QUIET_MINUTES * 60_000);

  const subscriptions = await prisma.subscription.findMany({
    where: { emailEnabled: true, follower: { bannedAt: null } },
    select: {
      id: true,
      followerId: true,
      sellerId: true,
      lastNotifiedAt: true,
      createdAt: true,
      follower: { select: { id: true, email: true, name: true } },
      seller: { select: { id: true, name: true, companyName: true, isPro: true } },
    },
    take: 5000,
  });

  // Regroupement par abonné : un email par personne, pas un par abonnement.
  type Entry = {
    sellerName: string;
    subscriptionIds: string[];
    listings: { title: string; price: number; location: string; url: string }[];
  };
  const perFollower = new Map<
    string,
    { email: string; name: string; sellers: Map<string, Entry> }
  >();

  for (const sub of subscriptions) {
    const since = sub.lastNotifiedAt ?? sub.createdAt;
    const fresh = await prisma.listing.findMany({
      where: {
        userId: sub.sellerId,
        status: "APPROVED",
        shadowBanned: false,
        deletedAt: null,
        createdAt: { gt: since, lte: settled },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, title: true, price: true, location: true },
    });
    if (fresh.length === 0) continue;

    const bucket =
      perFollower.get(sub.followerId) ??
      {
        email: sub.follower.email,
        name: sub.follower.name,
        sellers: new Map<string, Entry>(),
      };

    const sellerName = sub.seller.isPro
      ? (sub.seller.companyName ?? sub.seller.name)
      : sub.seller.name;

    bucket.sellers.set(sub.sellerId, {
      sellerName,
      subscriptionIds: [sub.id],
      listings: fresh.map((l) => ({
        title: l.title,
        price: l.price,
        location: l.location,
        url: `${BASE}${listingUrl(l.id, l.title)}`,
      })),
    });
    perFollower.set(sub.followerId, bucket);
  }

  let sent = 0;
  let listingsAnnounced = 0;

  for (const [followerId, bucket] of perFollower) {
    if (!bucket.email) continue;
    if (!(await isEmailAllowed(followerId, "favorites").catch(() => true))) continue;

    const sellers = [...bucket.sellers.values()];
    const total = sellers.reduce((n, s) => n + s.listings.length, 0);

    const sections = sellers
      .map(
        (s) => `
      <p style="margin:0 0 6px;font-weight:700;">${s.sellerName}</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 18px;">
        ${s.listings
          .map(
            (l) => `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #eceef0;">
              <a href="${l.url}" style="color:#191c1e;text-decoration:none;font-weight:600;">${l.title}</a>
              <div style="color:#777683;font-size:13px;margin-top:2px;">${l.location}</div>
            </td>
            <td style="padding:8px 0;border-bottom:1px solid #eceef0;text-align:right;white-space:nowrap;">
              <strong style="color:#2f6fb8;">${l.price.toLocaleString("fr-FR")} €</strong>
            </td>
          </tr>`,
          )
          .join("")}
      </table>`,
      )
      .join("");

    const subject =
      sellers.length === 1
        ? `${sellers[0].sellerName} a publié ${total} nouvelle${total > 1 ? "s" : ""} annonce${total > 1 ? "s" : ""}`
        : `${total} nouvelles annonces chez ${sellers.length} vendeurs que vous suivez`;

    const ok = await sendEmail({
      to: bucket.email,
      toName: bucket.name,
      subject,
      html: baseEmail({
        title: `${subject} — Deal & Co`,
        heading: subject,
        body: `
          <p style="margin:0 0 16px;">Bonjour ${bucket.name || ""},</p>
          <p style="margin:0 0 16px;">Voici ce qui vient d'être publié par les vendeurs auxquels vous êtes abonné :</p>
          ${sections}
        `,
        ctaLabel: "Voir les annonces",
        ctaUrl: `${BASE}/u/${sellers.length === 1 ? [...bucket.sellers.keys()][0] : ""}`,
      }),
      adSource: "subscription_digest",
      userId: followerId,
    })
      .then(() => true)
      .catch((err) => {
        console.error("[subscription-digest] email:", err);
        return false;
      });

    if (!ok) continue;

    // Le curseur n'avance qu'après un envoi réussi.
    await prisma.subscription.updateMany({
      where: { id: { in: sellers.flatMap((s) => s.subscriptionIds) } },
      data: { lastNotifiedAt: now },
    });

    sent++;
    listingsAnnounced += total;
  }

  return NextResponse.json({ sent, listingsAnnounced });
}

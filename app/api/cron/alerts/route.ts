import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSearchWhere } from "@/lib/search-where";
import { sendEmail } from "@/lib/email";
import { sendPushNotification } from "@/lib/notifications/send";
import { savedSearchAlertEmail } from "@/lib/emails/saved-search-alert";
import { listingPhotoReminderEmail } from "@/lib/emails/listing-photo-reminder";
import { listingSlug } from "@/lib/listing-slug";
import { INDEXABILITY_BAR, evaluateListing } from "@/lib/seo/indexability";
import { CATEGORIES } from "@/lib/categories";

const BASE = "https://www.dealandcompany.fr";
const MAX_LISTINGS_PER_EMAIL = 10;
// Minimum interval between two emails for the same alert (1 hour)
const MIN_INTERVAL_MS = 60 * 60 * 1000;

function buildSearchUrl(filters: Record<string, string>): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) {
    const cat = CATEGORIES.find((c) => c.id === filters.category || c.label === filters.category);
    params.set("category", cat ? cat.label : filters.category);
  }
  const skip = new Set(["q", "category"]);
  for (const [k, v] of Object.entries(filters)) {
    if (!skip.has(k) && v) params.set(k, v);
  }
  return `${BASE}/search?${params.toString()}`;
}

export async function GET(req: Request) {
  /**
   * `Authorization: Bearer` — la convention de tous les autres CRON du dépôt,
   * et surtout la seule que Vercel sache produire.
   *
   * Cette route lisait un paramètre `?secret=` dans l'URL. Elle n'était pas
   * planifiée, donc personne ne s'en était aperçu ; le jour où on l'inscrit
   * dans `vercel.json`, elle aurait répondu 401 à chaque exécution sans que
   * rien ne le signale. Un secret passé en query string se retrouve par
   * ailleurs dans les journaux d'accès, ce qu'un en-tête évite.
   */
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const minLastNotified = new Date(now.getTime() - MIN_INTERVAL_MS);

  // Load all saved searches not notified in the last hour
  const searches = await prisma.savedSearch.findMany({
    where: { lastNotifiedAt: { lte: minLastNotified } },
    include: { user: { select: { email: true, name: true } } },
  });

  let totalSent = 0;

  for (const search of searches) {
    const filters = JSON.parse(search.filters) as Record<string, string>;
    const where = buildSearchWhere(filters);

    const newListings = await prisma.listing.findMany({
      where: {
        ...where,
        createdAt: { gt: search.lastNotifiedAt },
      },
      select: {
        id: true,
        title: true,
        price: true,
        location: true,
        images: true,
      },
      orderBy: { createdAt: "desc" },
      take: MAX_LISTINGS_PER_EMAIL,
    });

    if (newListings.length === 0) continue;

    const alertListings = newListings.map((l) => {
      let imgs: string[] = [];
      try { imgs = JSON.parse(l.images); } catch { /* empty */ }
      return {
        id: l.id,
        title: l.title,
        price: l.price,
        location: l.location,
        imageUrl: imgs[0],
        url: `${BASE}/annonce/${l.id}/${listingSlug(l.title)}`,
      };
    });

    try {
      await sendEmail({
        to: search.user.email,
        toName: search.user.name,
        subject: `${newListings.length} nouvelle${newListings.length > 1 ? "s" : ""} annonce${newListings.length > 1 ? "s" : ""} pour "${search.name}" — Deal & Co`,
        html: savedSearchAlertEmail({
          name: search.user.name,
          searchName: search.name,
          searchUrl: buildSearchUrl(filters),
          listings: alertListings,
          manageUrl: `${BASE}/recherches`,
        }),
      });

      sendPushNotification({
        userId: search.userId,
        template: newListings.length > 1 ? "multiple_alert_matches" : "saved_alert_match",
        variables: {
          count: newListings.length,
          alertName: search.name,
          alertId: search.id,
          listingId: newListings[0].id,
        },
      }).catch(() => {});

      await prisma.savedSearch.update({
        where: { id: search.id },
        data: { lastNotifiedAt: now },
      });

      totalSent++;
    } catch (err) {
      console.error(`[cron/alerts] Failed to send for search ${search.id}:`, err);
    }
  }

  /**
   * ── Rappel photo ────────────────────────────────────────────────────────
   *
   * Ce bloc n'a jamais envoyé un seul message, pour trois raisons cumulées, et
   * il a fallu les corriger toutes les trois.
   *
   *   1. **La route n'était pas planifiée.** `/api/cron/alerts` ne figurait pas
   *      dans `vercel.json` — le code existait, rien ne l'appelait.
   *
   *   2. **Le critère visait une population vide.** Il cherchait
   *      `images in ["[]", "", "null"]`, c'est-à-dire zéro photo. Le relevé du
   *      27/08/2026 est sans appel : aucune annonce publiée n'est sans photo.
   *      37 sont sous le seuil — 17 en ont une, 20 en ont deux — et c'est
   *      exactement à celles-là que le message est utile.
   *
   *   3. **La fenêtre excluait le stock existant.** Elle ne retenait que les
   *      annonces créées entre 30 minutes et 6 heures plus tôt. Une annonce
   *      publiée hier ne pouvait plus jamais être rattrapée, alors que c'est
   *      précisément le retard accumulé qui coûte de la visibilité aujourd'hui.
   *
   *   4. **Le message ne citait qu'un motif.** Il disait « ajoutez des photos »
   *      quel que soit le blocage réel. Un vendeur à qui il manquait quinze
   *      lignes de description ajoutait une photo, ne voyait rien changer, et
   *      concluait que le conseil ne valait rien.
   *
   * Les motifs viennent donc de `evaluateListing` — le juge qui décide du
   * `noindex` — et non d'une règle réécrite ici. Écrire « 3 photos » en dur
   * promettrait au vendeur une visibilité que le juge ne lui accorderait pas si
   * le seuil bougeait, et les comptes professionnels ont leur propre barre.
   *
   * Seuls les motifs réparables par le vendeur sont retenus, et seulement quand
   * ils sont les seuls : une annonce importée d'un flux partenaire resterait
   * `noindex` même avec dix photos de plus.
   *
   * `photoReminderSentAt` protège du doublon, et le plafond par exécution étale
   * la campagne au lieu de l'envoyer en une salve.
   */
  const reminderCandidates = await prisma.listing.findMany({
    where: {
      status: "APPROVED",
      deletedAt: null,
      shadowBanned: false,
      photoReminderSentAt: null,
      // Une annonce doit avoir vécu un peu : inutile d'écrire à quelqu'un qui
      // est encore en train de compléter sa publication.
      createdAt: { lte: new Date(now.getTime() - 30 * 60 * 1000) },
    },
    select: {
      id: true, title: true, description: true, images: true, metadata: true,
      price: true, category: true, subcategory: true, location: true, condition: true,
      status: true, shadowBanned: true, deletedAt: true, qualityScore: true,
      reportCount: true, imageDupCount: true, createdAt: true, updatedAt: true,
      user: { select: { email: true, name: true, isPro: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const countImages = (raw: string): number => {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((u) => typeof u === "string").length : 0;
    } catch {
      return 0;
    }
  };

  /**
   * Seuls ces deux motifs se corrigent depuis le formulaire d'édition.
   *
   * Les autres — annonce importée d'un flux partenaire, signalements, photos
   * déjà vues ailleurs — ne dépendent pas du vendeur. Lui écrire à leur sujet,
   * c'est réclamer un geste qu'il ne peut pas faire.
   */
  const FIXABLE = new Set(["PAS_ASSEZ_DE_PHOTOS", "DESCRIPTION_TROP_COURTE"]);

  const belowBar = reminderCandidates.flatMap((listing) => {
    const bar = listing.user.isPro ? INDEXABILITY_BAR.pro : INDEXABILITY_BAR.particulier;
    const verdict = evaluateListing({
      ...listing,
      isPro: !!listing.user.isPro,
    } as Parameters<typeof evaluateListing>[0]);

    if (verdict.indexable) return [];
    // Une annonce qui cumule un motif réparable et un motif qui ne l'est pas
    // resterait `noindex` après l'effort demandé. On ne la cite pas.
    if (!verdict.reasons.every((reason) => FIXABLE.has(reason))) return [];

    const missing: { label: string; detail: string }[] = [];
    if (verdict.reasons.includes("PAS_ASSEZ_DE_PHOTOS")) {
      const have = countImages(listing.images);
      const need = bar.minImages - have;
      missing.push({
        label: need === 1 ? "1 photo à ajouter" : `${need} photos à ajouter`,
        detail: `${have} en ligne, ${bar.minImages} demandées`,
      });
    }
    if (verdict.reasons.includes("DESCRIPTION_TROP_COURTE")) {
      const have = listing.description?.trim().length ?? 0;
      missing.push({
        label: `${bar.minDescription - have} caractères à ajouter`,
        detail: `description de ${have} caractères, ${bar.minDescription} demandés`,
      });
    }
    if (!missing.length) return [];

    return [{ listing, missing }];
  });

  /**
   * Un message par vendeur, pas un par annonce.
   *
   * Le rattrapage du 27/08/2026 aurait produit 40 envois pour 15 personnes,
   * dont vingt courriels d'affilée au même vendeur — celui qui publie le plus
   * sur le site. Le regroupement est donc une condition de l'envoi, pas une
   * élégance : sans lui, la campagne coûte plus de confiance qu'elle ne
   * rapporte d'annonces complétées.
   */
  const byUser = new Map<
    string,
    { name: string; listings: { id: string; title: string; missing: { label: string; detail: string }[] }[] }
  >();

  for (const { listing, missing } of belowBar) {
    const entry = byUser.get(listing.user.email) ?? { name: listing.user.name, listings: [] };
    entry.listings.push({ id: listing.id, title: listing.title, missing });
    byUser.set(listing.user.email, entry);
  }

  let photoRemindersSent = 0;

  /**
   * Trois vendeurs par exécution, une exécution par jour.
   *
   * Le rattrapage porte sur 15 personnes : au rythme retenu, la campagne
   * s'étale sur cinq jours au lieu de partir en une salve. Deux raisons.
   *
   * La première tient à la réputation d'expéditeur : un domaine qui n'envoie
   * presque rien puis quinze messages d'un coup ressemble, pour un filtre
   * anti-spam, à un domaine compromis. Le premier message qui compte est celui
   * qui arrive en boîte de réception.
   *
   * La seconde est qu'on veut pouvoir s'arrêter. Si le message ne fonctionne
   * pas — aucune photo ajoutée, des désabonnements — on le constate après
   * trois envois, pas après quinze.
   *
   * `photoReminderSentAt` garantit que les jours suivants prennent la suite de
   * la liste plutôt que de recommencer au début.
   */
  const MAX_SELLERS_PER_RUN = 3;

  for (const [email, entry] of [...byUser].slice(0, MAX_SELLERS_PER_RUN)) {
    try {
      await sendEmail({
        to: email,
        toName: entry.name,
        subject:
          entry.listings.length === 1
            ? `"${entry.listings[0].title}" n'apparaît pas sur Google — voici pourquoi`
            : `${entry.listings.length} de vos annonces n'apparaissent pas sur Google — voici pourquoi`,
        html: listingPhotoReminderEmail({
          name: entry.name,
          listings: entry.listings,
        }),
      });

      // Toutes les annonces citées sont marquées : elles figurent dans le
      // message, les rappeler demain serait répéter la même demande.
      await prisma.listing.updateMany({
        where: { id: { in: entry.listings.map((l) => l.id) } },
        data: { photoReminderSentAt: now },
      });

      photoRemindersSent++;
    } catch (err) {
      console.error(`[cron/alerts] Photo reminder failed for ${email}:`, err);
    }
  }

  return NextResponse.json({
    alerts: { checked: searches.length, sent: totalSent },
    photoReminders: {
      listingsBelowBar: belowBar.length,
      sellersPending: byUser.size,
      sent: photoRemindersSent,
    },
  });
}

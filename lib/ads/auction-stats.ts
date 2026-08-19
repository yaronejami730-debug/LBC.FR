/**
 * Compteurs d'enchères : combien de fois une campagne s'est présentée, combien
 * de fois elle a gagné.
 *
 * C'est la réponse à la seule question qu'un annonceur pose quand ses
 * impressions baissent : « est-ce que je suis trop cher, ou est-ce qu'il n'y a
 * plus de trafic ? ». « Vous étiez en lice 4 000 fois et servi 300 fois » se
 * comprend ; « vos impressions ont baissé » ne se comprend pas.
 *
 * Les incréments sont **tamponnés en mémoire puis écrits par paquets**. Une
 * écriture par candidat et par affichage multiplierait par cinq le coût en base
 * d'une page — pour une statistique, pas pour une facture. La distinction est
 * assumée : ce compteur peut perdre quelques unités au redémarrage d'une
 * instance, la facturation ne le peut pas, et elle ne passe pas par ici.
 */
import { prisma } from "@/lib/prisma";
import { parisDay } from "./stats";

type Key = string;
type Bucket = {
  day: Date;
  campaignId: string;
  placement: string;
  entries: number;
  wins: number;
  adRankSum: number;
};

const buffer = new Map<Key, Bucket>();

/** Au-delà, on écrit : ni trop souvent (coûteux), ni trop tard (perdu). */
const FLUSH_ROWS = 40;
const FLUSH_MS = 20_000;
let lastFlush = Date.now();
let flushing: Promise<void> | null = null;

function bucketFor(campaignId: string, placement: string, at: Date): Bucket {
  const day = parisDay(at);
  const key = `${day.toISOString()}|${campaignId}|${placement}`;
  const existing = buffer.get(key);
  if (existing) return existing;
  const fresh: Bucket = { day, campaignId, placement, entries: 0, wins: 0, adRankSum: 0 };
  buffer.set(key, fresh);
  return fresh;
}

/**
 * Enregistre une enchère : tous les participants, et le gagnant.
 *
 * Ne renvoie pas de promesse à attendre : la publicité doit partir vers le
 * visiteur, pas attendre un compteur.
 */
export function recordAuction(input: {
  placement: string;
  entrants: { campaignId: string }[];
  winner: { campaignId: string; adRank: number } | null;
  at?: Date;
}): void {
  const at = input.at ?? new Date();
  for (const entrant of input.entrants) {
    bucketFor(entrant.campaignId, input.placement, at).entries += 1;
  }
  if (input.winner) {
    const b = bucketFor(input.winner.campaignId, input.placement, at);
    b.wins += 1;
    b.adRankSum += input.winner.adRank;
  }

  if (buffer.size >= FLUSH_ROWS || Date.now() - lastFlush > FLUSH_MS) {
    void flushAuctionStats();
  }
}

/** Écrit le tampon. Appelée aussi par le cron, pour ne rien laisser traîner. */
export async function flushAuctionStats(): Promise<void> {
  if (flushing) return flushing;
  if (buffer.size === 0) return;

  const rows = [...buffer.values()];
  buffer.clear();
  lastFlush = Date.now();

  flushing = (async () => {
    for (const row of rows) {
      try {
        await prisma.adStatDaily.upsert({
          where: {
            day_campaignId_placement_citySlug: {
              day: row.day,
              campaignId: row.campaignId,
              placement: row.placement,
              citySlug: "",
            },
          },
          update: {
            auctionEntries: { increment: row.entries },
            auctionWins: { increment: row.wins },
            adRankSum: { increment: row.adRankSum },
          },
          create: {
            day: row.day,
            campaignId: row.campaignId,
            placement: row.placement,
            citySlug: "",
            auctionEntries: row.entries,
            auctionWins: row.wins,
            adRankSum: row.adRankSum,
          },
        });
      } catch {
        // Une campagne supprimée entre l'enchère et l'écriture : le compteur
        // n'a plus de destinataire, et ce n'est pas une raison d'échouer.
      }
    }
  })().finally(() => {
    flushing = null;
  });

  return flushing;
}

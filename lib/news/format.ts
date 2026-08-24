/**
 * Mise en forme des signatures et des dates d'article.
 *
 * ── Pourquoi un module pour ça ────────────────────────────────────────────
 *
 * Trois mentions doivent apparaître partout où un article est présenté, sans
 * exception : **qui l'a écrit, quel jour, à quelle heure**. Une actualité sans
 * heure ne se distingue pas d'une archive, et un article sans signature laisse
 * croire qu'il est de nous. Les centraliser ici est ce qui garantit qu'aucune
 * page ne les oublie.
 *
 * L'heure est rendue en heure de Paris, explicitement. Le serveur tourne en
 * UTC : sans fuseau imposé, un article publié à 00 h 30 s'afficherait daté de
 * la veille.
 */

import { DEFAULT_BYLINE } from "@/lib/news/sources";

const TZ = "Europe/Paris";

/** « 24 août 2026 » */
export function frDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  });
}

/** « 19 h 11 » */
export function frTime(d: Date): string {
  return d
    .toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ })
    .replace(":", " h ");
}

/** « 24 août 2026 à 19 h 11 » */
export function frDateTime(d: Date): string {
  return `${frDate(d)} à ${frTime(d)}`;
}

/**
 * La signature complète : la personne, puis le média.
 *
 * Jamais « Deal&Co ». Quand le recoupement des flux par journaliste n'a rien
 * donné, on écrit « La rédaction » — c'est vrai, et c'est tout ce qu'on sait.
 */
export function byline(authorName: string | null, publisher: string): string {
  return `${authorName ?? DEFAULT_BYLINE} · ${publisher}`;
}

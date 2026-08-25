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

/**
 * Découpe une citation en paragraphes.
 *
 * Le découpage n'est pas décidé ici : `excerptOf` a conservé les fins de
 * paragraphe du média sous forme de sauts de ligne. Cette fonction ne fait que
 * les rendre exploitables par une page, qui en fera autant de `<p>`. Un long
 * extrait rendu en un seul bloc est un mur — personne ne le lit.
 */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Le chapô long d'une une : ce qu'on affiche sous un titre en grand.
 *
 * ── Pourquoi il ne se réduit pas au `summary` ─────────────────────────────
 *
 * Le `summary` d'un flux fait deux lignes. Sous une photo en 16/9 et un titre
 * en corps 30, deux lignes ne racontent rien : le lecteur doit cliquer pour
 * savoir de quoi il s'agit, et la une ne remplit pas son office. On y adjoint
 * donc le début de la citation du corps, bornée par ailleurs à sa proportion
 * légale — de quoi tenir une dizaine de lignes.
 *
 * Le `summary` n'est jamais répété : quand la citation le reprend mot pour mot,
 * ce qui arrive chez les médias dont le chapô est la première phrase de
 * l'article, c'est la citation seule qui parle.
 */
export function lede(
  article: { summary: string | null; excerpt: string | null },
  maxChars = 900,
): string[] {
  const parts: string[] = [];
  const summary = article.summary?.trim() ?? "";
  const body = article.excerpt ? paragraphs(article.excerpt) : [];

  // Doublon : le chapô est déjà la première phrase du corps chez plusieurs
  // médias. L'afficher deux fois donne une page qui bégaie.
  const repeats = summary.length > 0 && body[0]?.startsWith(summary.slice(0, 60));
  if (summary && !repeats) parts.push(summary);

  let used = parts.join(" ").length;
  for (const p of body) {
    if (used >= maxChars) break;
    parts.push(p);
    used += p.length;
  }
  return parts;
}

/**
 * Ancienneté d'une annonce, en relatif — sur toute l'échelle.
 *
 * ── Ce qui n'allait pas ───────────────────────────────────────────────────
 *
 * Les trois premières branches disaient « À l'instant », « Il y a 12 min »,
 * « Il y a 3h ». La quatrième basculait sur `formatDate` :
 *
 *     mercredi 26 août à 03h21
 *
 * Une fonction nommée « distance jusqu'à maintenant » qui renvoie un horodatage
 * absolu à la minute près se contredit elle-même, et le résultat est mauvais
 * des deux côtés.
 *
 * Pour le lecteur : personne ne cherche à quelle minute une annonce a été
 * publiée il y a trois semaines. Ce qu'il veut savoir, c'est si elle est
 * fraîche. « Il y a 3 sem. » répond ; « mercredi 26 août à 03h21 » lui demande
 * de faire le calcul.
 *
 * Pour le référencement : chaque carte d'annonce ajoutait six mots vides au
 * texte de la page — un jour de la semaine, un quantième, un mois, « à », une
 * heure. Sur une page de vingt-quatre annonces, cent quarante jetons qui ne
 * disent rien du sujet. Un audit du 28/08/2026 le mesure : sur une page de
 * 1 014 mots, les trois premiers mots-clés relevés sont « août » (17),
 * « jeudi » (13) et « sur » (11), devant « annonces » et « france ». Le contenu
 * de la page parlait de dates, pas d'annonces.
 *
 * ── L'échelle retenue ─────────────────────────────────────────────────────
 *
 * La précision décroît avec l'ancienneté, parce que c'est ainsi qu'on lit une
 * date : à la minute dans l'heure, au jour dans le mois, au mois au-delà. Les
 * abréviations (« sem. », « j ») tiennent dans la ligne d'une carte.
 *
 * `formatDate` n'est pas modifiée : trois écrans affichent une date absolue à
 * dessein — un reçu, un agenda — et ils ont raison de le faire.
 */
export function formatDistanceToNow(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} j`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `Il y a ${weeks} sem.`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? "Il y a 1 mois" : `Il y a ${months} mois`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? "Il y a 1 an" : `Il y a ${years} ans`;
}

export function formatDate(date: Date): string {
  const d = new Date(date);
  const days = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

  const dayName = days[d.getDay()];
  const dayNum = d.getDate();
  const month = months[d.getMonth()];
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");

  return `${dayName} ${dayNum} ${month} à ${hours}h${mins}`;
}

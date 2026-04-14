export function formatDistanceToNow(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours}h`;

  // Au-delà de 24h → date fixe complète
  return formatDate(d);
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

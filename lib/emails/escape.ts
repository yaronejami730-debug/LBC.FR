/**
 * Échappement des valeurs utilisateur insérées dans le HTML d'un email.
 *
 * Les gabarits d'email sont des littéraux de gabarit : `${senderName}` est
 * recopié tel quel dans le document. Tant que la valeur vient de nous, tout va
 * bien ; dès qu'elle vient d'un tiers, elle peut fermer une balise et en ouvrir
 * une autre.
 *
 * Le cas qui compte n'est pas le script — les messageries les suppriment
 * toutes — c'est le lien. Un acheteur qui écrit
 *
 *     Bonjour</p><a href="https://faux-paiement.example">Payer la caution ici</a><p>
 *
 * fait arriver son lien dans un email expédié par `notif@dealandcompany.fr`,
 * signé par notre domaine, passant nos enregistrements SPF et DKIM. C'est la
 * réputation d'expéditeur du site qui sert d'appât. Sur une place de marché,
 * c'est exactement le mode opératoire recherché par les escrocs.
 *
 * À appliquer sur toute valeur que le destinataire n'a pas écrite lui-même :
 * nom d'un tiers, contenu d'un message, titre d'annonce, motif saisi.
 * Les fragments HTML que nous composons nous-mêmes (`reasonBlock`, `rows`)
 * n'ont évidemment pas à passer par ici.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Variante pour les valeurs placées dans un attribut `href`.
 *
 * Bloque les schémas exécutables (`javascript:`, `data:`, `vbscript:`) et
 * n'autorise que ce qui mène réellement quelque part. Une URL rejetée devient
 * un lien vers l'accueil plutôt qu'un attribut vide : un `href=""` recharge la
 * page courante, ce qui, dans un email, ne veut rien dire.
 */
export function escapeUrl(value: unknown, fallback = "https://www.dealandcompany.fr"): string {
  const raw = String(value ?? "").trim();
  if (!/^https?:\/\//i.test(raw)) return fallback;
  return escapeHtml(raw);
}

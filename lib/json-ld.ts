/**
 * Sérialisation sûre des données structurées injectées dans `<script>`.
 *
 * `JSON.stringify` échappe les guillemets et les antislashs. Il n'échappe pas
 * `<`, `>` ni `/`, parce que ce sont des caractères parfaitement valides dans
 * une chaîne JSON. Le problème est ailleurs : le contenu n'est pas lu par un
 * analyseur JSON, il est d'abord lu par l'analyseur HTML du navigateur, et
 * celui-ci ferme le bloc `<script>` au premier `</script` rencontré — à
 * l'intérieur d'une chaîne comme ailleurs, il ne connaît pas le JSON.
 *
 * Un titre d'annonce contenant
 *
 *     </script><img src=x onerror=…>
 *
 * fermait donc la balise et exécutait la suite comme du HTML de la page. Le
 * titre est saisi par le vendeur, il n'est pas modéré avant publication
 * (`Listing.status` vaut `APPROVED` par défaut), et les données structurées
 * reprennent titre et description mot pour mot : c'était une injection stockée
 * sur le type de page le plus visité du site.
 *
 * Les trois séquences remplacées ci-dessous sont invisibles pour un analyseur
 * JSON — `<` et `<` désignent le même caractère — et inertes pour
 * l'analyseur HTML. Le rendu Google Rich Results est inchangé.
 *
 *     <script type="application/ld+json"
 *       dangerouslySetInnerHTML={{ __html: safeJsonLd(monObjet) }} />
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    // U+2028 / U+2029 terminent une ligne pour l'analyseur JavaScript alors
    // qu'ils sont des caractères ordinaires en JSON. Sans échappement, un
    // séparateur de ligne collé dans une description casse le script.
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

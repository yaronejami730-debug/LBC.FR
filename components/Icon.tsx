/**
 * Icône Material Symbols dont le nom ne compte pas comme du texte de la page.
 *
 * ── Le problème ───────────────────────────────────────────────────────────
 *
 * Une icône Material Symbols s'écrit en posant le nom de la ligature comme
 * contenu de l'élément :
 *
 *     <span className="material-symbols-outlined">expand_more</span>
 *
 * La police substitue le dessin au texte. Mais le texte, lui, reste dans le
 * DOM : c'est un nœud texte ordinaire, que tout ce qui lit la page lit. Un
 * audit du 28/08/2026 le donne en quatrième mot-clé de l'accueil, à égalité
 * avec « annonces » et « france » :
 *
 *     août 17 · jeudi 13 · sur 11 · expandmore 11 · annonces 11 · france 11
 *
 * Relevé sur le HTML servi en production : **21 occurrences de `expand_more`
 * sur la page d'accueil**, 8 sur chaque page de catégorie. Le mot n'apparaît
 * pourtant qu'une fois par fichier source — il est rendu dans la boucle des
 * questions fréquentes, une fois par question.
 *
 * Ce n'est pas un mot que quiconque cherche. Il dilue le profil lexical de la
 * page : sur mille mots, une trentaine de jetons qui ne disent rien du sujet.
 *
 * ── Ce que ce composant change ────────────────────────────────────────────
 *
 * Le nom passe du contenu à un attribut, et la CSS le réinjecte en contenu
 * généré (`content: attr(data-icon)`, dans `globals.css`). Le rendu est
 * identique — la substitution de ligature s'applique au contenu généré comme
 * au texte — mais un contenu généré par CSS n'appartient pas au DOM : il n'est
 * ni extrait, ni compté, ni lu à voix haute.
 *
 * `aria-hidden` complète le tableau. Une icône décorative annoncée « expand
 * more » par un lecteur d'écran est du bruit ; quand l'icône porte du sens,
 * c'est au texte voisin de le dire, pas au nom de la ligature.
 *
 * ⚠️ Réserver aux icônes **décoratives**. Une icône seule qui porte une action
 * — une croix de fermeture sans libellé — a besoin d'un nom accessible, donc
 * d'un `aria-label` sur le bouton qui la contient.
 */
export default function Icon({
  name,
  className = "",
  style,
}: {
  /** Nom de la ligature Material Symbols, par exemple `expand_more`. */
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`.trim()}
      data-icon={name}
      aria-hidden="true"
      style={style}
    />
  );
}

# Design system — app mobile Deal&Company

Palette bicolore **bleu + blanc**. Aucun orange, aucun accent tiers.

## Où sont les tokens

| Usage | Source |
|---|---|
| `className` (NativeWind) | `tailwind.config.js` |
| props JS (Ionicons, Tabs, StatusBar, MapView, styles inline) | `lib/theme.ts` |

Les deux fichiers doivent rester synchronisés. Ne jamais écrire un hex en dur dans `app/` ou `components/`.

## Couleurs

| Rôle | Classe | Token JS | Hex |
|---|---|---|---|
| CTA, prix, état actif | `primary` | `colors.primary` | `#1046D6` |
| Pressed / dégradé | `primary-dark` | `colors.primaryDark` | `#0C36A8` |
| Tags, pastilles, fonds de section | `primary-light` | `colors.primaryLight` | `#E8EEFC` |
| Fonds sombres, overlays, segment actif | `navy` | `colors.navy` | `#0B1E4D` |
| Cards, barres | `surface` | `colors.surface` | `#FFFFFF` |
| Fond d'écran | `app` | `colors.app` | `#F7F8FA` |
| Champs, placeholders image | `surface-container` | `colors.surfaceContainer` | `#F1F2F5` |
| Texte principal | `on-surface` | `colors.onSurface` | `#101A33` |
| Texte secondaire | `on-surface-variant` | `colors.onSurfaceVariant` | `#6B7488` |
| Désactivé | `outline` | `colors.outline` | `#98A0B3` |
| Bordures | `line` | `colors.line` | `#E4E7EC` |
| Succès | `success` | `colors.success` | `#2E9E8F` |
| Erreur | `danger` | `colors.danger` | `#D6432F` |

Il n'y a pas de couleur « avertissement » : les états d'alerte utilisent `danger`, les états informatifs `primary-light`.

## Rayons

`rounded-card` (22 px) pour les cards, `rounded-sheet` (28 px) pour les feuilles et modales, `rounded-full` pour tous les boutons et pills.

## Composants — `components/ui/`

| Composant | Usage |
|---|---|
| `Button` | variants `primary` / `secondary` / `ghost` / `danger`, tailles `sm` / `md` / `lg`, `loading`, `icon` |
| `Card` | card blanche arrondie, `clip` si une image touche les bords, `elevated` pour l'ombre |
| `SegmentedControl` | pilule pleine largeur, onglet actif bleu marine, `count` optionnel |
| `Pill` / `Tag` | pill d'info bordée avec bouton d'action rond ; tag bleu pâle ↔ bleu plein |
| `Avatar` | cercle bleu marine à initiales, ou photo ; `ring` pour le contour blanc |
| `StackedAvatars` | cercles chevauchés + « X personnes intéressées » |
| `GlassBadge` | overlay bleu marine 60 % — **uniquement au-dessus d'une image** |

## Typographie

Inter, chargée dans `app/_layout.tsx` via `lib/fonts.ts`.

Inter est en statique (un fichier par graisse) : `lib/fonts.ts` mappe `fontWeight` → famille et enveloppe le rendu de `Text` / `TextInput`, sinon Android fabrique un faux gras et iOS reste en Regular. Conséquence : garder l'écriture des graisses via `fontWeight` / classes `font-*`, jamais via `fontFamily` en dur.

Hiérarchie : prix et compteurs toujours plus gros et plus gras que le texte autour. Les prix sont en `text-primary`.

## Règles

- Un seul accent chromatique : le bleu.
- Cards blanches sur fond `bg-app` — les écrans démarrent en `flex-1 bg-app`.
- Glassmorphism réservé aux overlays sur image, jamais sur fond uni.
- Les ombres utilisent `colors.navy`, pas du noir.

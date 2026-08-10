# Catalogue prestations PRO — v1.0.0

**2 200 prestations** · 30 catégories · 177 sous-catégories · 73 champs dynamiques · 30 domaines d'activité.

## Fichiers

| Fichier | Usage |
|---|---|
| `catalogue_prestations_pro.json` (2,3 Mo) | source de vérité, arbre complet + champs + règles |
| `autosuggest_index.json` (1,2 Mo) | index plat léger, à charger dans l'app pour l'autocomplétion |
| `build_catalog.py` | générateur — on modifie le catalogue ici, jamais le JSON à la main |

## Structure

```
catégorie (C08)
└── sous-catégorie (C08.S01)
    └── sous-sous-catégorie = prestation publiable (C08.S01.L001)
```

Chaque feuille porte : `label`, `base_label`, `variant`, `keywords` (autosuggestion),
`fields` (champs du formulaire à afficher), `domain`, `requires_qualification`, `regulated`.

## Le dynamique — 3 niveaux

**1. Champs dynamiques.** `fields` est calculé par catégorie + règles de mots-clés.
Une annonce « Tonte de pelouse » affiche `surface_terrain`, `evacuation_dechets` ;
« Course VTC » affiche `capacite_passagers`, `distance_km`, `licence_transport`.
Le front lit `field_definitions` (type + options) et génère le formulaire.

**2. Déclinaisons (`variants`).** Chaque catégorie expose une liste de variantes
(`à domicile`, `en urgence`, `forfait 5 séances`…). L'app peut les proposer en second temps
sans multiplier les entrées du catalogue — 224 déclinaisons sont déjà pré-générées comme
feuilles à part entière pour l'autosuggestion.

**3. Cohérence métier.** Le pro déclare 1 domaine principal (+2 secondaires max).

```js
function checkCoherence(proDomains, leaf) {
  const d = domains.find(x => x.id === proDomains.main);
  const catId = leaf.id.split('.')[0];
  if (d.allowed_categories.includes(catId))  return 'allow';   // publication directe
  if (d.adjacent_categories.includes(catId)) return 'review';  // avertissement + modération
  if (proDomains.secondary.some(s => domainOf(s).allowed_categories.includes(catId)))
                                             return 'allow';
  return 'block'; // « Votre activité déclarée est VTC — ajoutez une activité secondaire justifiée »
}
```

Un VTC (`transport`) → allow sur Transport, review sur Automobile/Événementiel/Aide à la personne,
**block** sur Beauté. Pour débloquer : SIRET/code APE compatible, RC Pro, diplôme si réglementé.

**Feuilles réglementées : 692/2 200.** `requires_qualification` liste les justificatifs
(carte VTC, DE infirmier, carte CNAPS, certification COFRAC, RGE, HACCP, Certibiocide, décennale…).
À bloquer tant que le document n'est pas validé.

## Les 3 parcours de publication

| Parcours | Entrée | Traitement |
|---|---|---|
| Prompt libre | texte long du pro | matching sur `kw` + `label` de l'index plat → propose 3 feuilles → pré-remplit `fields` |
| Annonce simple | recherche tapée | autosuggestion sur l'index plat (fuzzy sur `label` + `kw`) |
| Boutique pro | catalogue filtré | on n'affiche que les catégories `allowed` + `adjacent` du domaine du pro |

## Intégration dans LBC.fr

| Module | Rôle |
|---|---|
| `lib/pro-catalog/types.ts` | types du JSON **et** contrat des réponses d'API — partagé serveur/client |
| `lib/pro-catalog/index.ts` | arbre complet (2,3 Mo), **serveur uniquement**. Index Map construits au 1er accès |
| `lib/pro-catalog/suggest.ts` | index plat seul (1,2 Mo). Découplé de `index.ts` pour ne pas charger l'arbre |
| `lib/pro-catalog/client.ts` | client navigateur, types seuls — aucun JSON dans le bundle |
| `mobile/lib/pro-catalog.ts` | client Expo, plan du catalogue en cache `AsyncStorage` |
| `app/api/taxonomy/pro/route.ts` | vues `outline` / `category` / `leaf` / `fields` / `domains` / `coherence` |
| `app/api/taxonomy/pro/suggest/route.ts` | `?q=` (recherche tapée) et `?prompt=` (texte libre) |

L'arbre n'est **jamais** renvoyé d'un bloc : `outline` donne les 30 catégories et
177 sous-catégories, les feuilles arrivent à l'ouverture d'une catégorie.

`checkProCoherence()` implémente le pseudo-code plus haut. Un domaine secondaire
n'ouvre que ses catégories `allowed`, jamais ses adjacentes en cascade — sinon
deux secondaires bien choisis débloquent la moitié du catalogue.

⚠️ Le verdict de cohérence renvoyé au client sert à **afficher l'avertissement**.
La vérification doit être rejouée côté serveur au moment de publier.

## Faire évoluer le catalogue

Éditer `C[...]["subs"]` dans `build_catalog.py` (feuilles séparées par `|`), puis `python3 build_catalog.py`.
`TARGET_LEAVES` contrôle le volume total. Les IDs sont positionnels : ajouter en **fin** de liste
pour ne pas casser les références existantes en base.

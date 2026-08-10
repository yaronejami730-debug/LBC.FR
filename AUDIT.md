# AUDIT — Phase 0, moteur d'annonces piloté par configuration

État du code au 10 août 2026, branche `main`. Aucune modification applicative
n'a été faite pour cet audit. Seul ajout : `scripts/test-classifier-toponyms.ts`
(`npm run test:toponymes`), le test de reproduction demandé au §4.

---

## 1. Modèle de données actuel

**Une seule table**, `Listing` (`prisma/schema.prisma`), **78 colonnes**,
PostgreSQL (Neon). Il n'existe ni table d'attributs, ni notion de type d'annonce.

**Volume réel en production** : 318 annonces, dont 284 non supprimées.

| Catégorie | Annonces | | Catégorie | Annonces |
|---|---:|---|---|---:|
| Véhicules | 154 | | Divers | 11 |
| Immobilier | 54 | | Services | 9 |
| Maison | 27 | | Emploi | 4 |
| Multimédia | 25 | | Communauté | 2 |
| Loisirs | 17 | | Animaux / Bébé / Vacances | 1 chacun |
| Mode | 12 | | | |

Trois régimes de stockage des attributs cohabitent :

1. **Colonnes typées dédiées** — `condition`, `brand`, `material`, `vehicleKm`,
   `vehicleYear`, `immoSurface`, `immoRooms`. Ce sont les seuls attributs
   filtrables en SQL. Le choix de ces quatre-là est historique, pas structurel :
   ce sont ceux dont la recherche avait besoin.
2. **`metadata String @default("{}")`** — JSON sérialisé **en texte**, pas
   `Json`. Non requêtable côté Postgres sans cast. **231 annonces sur 318** ont
   un `metadata` non vide : c'est déjà le vrai support des attributs.
3. **Colonnes de modération / SEO** — une trentaine (`riskScore`, `phoneHash`,
   `phashBands`, `postedAs`, `addressLine`…), sans rapport avec le type
   d'annonce.

**Il existe donc déjà un champ JSON libre.** Le passage à `attributes` est un
renommage sémantique et un changement de type (`String` → `Json`), pas une
création.

Depuis le moteur d'intention livré la semaine du 10 août, `metadata.intent`
porte `{ nature, fieldSet, confidence, version }`. C'est un ancêtre direct de
`listing_type_key`, avec 11 régimes au lieu de ~200 types.

---

## 2. Formulaire actuel

**Un composant unique**, `app/post/PostForm.tsx` — **2 276 lignes**, 36 `useState`.
Le formulaire mobile est un second composant, `mobile/app/(tabs)/post.tsx`, qui
réplique la même logique dans une autre techno.

Structure : 6 étapes fixes (`FormStep = 0 | 1 | 2 | 3 | 4 | 5`), identiques pour
toutes les catégories. À l'intérieur, des blocs conditionnels codés en dur —
**6 occurrences de `categoryId === "…"`** — qui ajoutent des groupes de champs :

| Bloc | Champs | Déclenchement |
|---|---:|---|
| `VehicleFields` | 22 | `categoryId === "vehicules"` |
| `ImmobilierFields` | 22 | `categoryId === "immobilier"` |
| Détails de prestation | 4 + carte pro | régime `serviceDetails` (voir plus bas) |
| Champs `extra` déclarés en données | variable | régime courant |

**Champs affichés dans tous les cas** : titre, prix, description, localisation,
photos, téléphone. Six champs. Tout le reste est conditionnel.

Nuance importante par rapport à l'hypothèse du brief : depuis le moteur
d'intention, **l'affichage n'est plus piloté par la catégorie mais par un
« régime de champs »** (`lib/offer-fields.ts`, 11 régimes) résolu à partir du
titre. Le renderer générique des champs `extra` existe déjà, dans les deux
formulaires, et le mobile lit ces régimes via `/api/taxonomy` sans rebuild.

C'est une préfiguration à petite échelle de `ListingType`. Le pack va beaucoup
plus loin : étapes configurables, héritage `extends`, JsonLogic, tarification
multiple, blocs d'affichage, versionnement. Aucun de ces cinq points n'existe.

---

## 3. Catégorisation actuelle

**Code exact** : `lib/autoCategory.ts` → `detectCategory(title, description)`,
qui délègue à `lib/classifier.ts` (`AdClassifier`, index inversé pondéré) sur la
taxonomie `lib/categories-classifier.json` (12 catégories, 55 sous-catégories).
Un aiguillage préalable envoie le bien-être vers `lib/wellness/classify.ts`.

Réponses aux cinq questions du brief :

**a. Sur quoi porte la recherche ?**
Sur les **libellés de la taxonomie**, pas sur le texte des annonces existantes.
`AdClassifier._buildIndex()` n'indexe que `keywords`, `brands`, `models`,
`synonyms`, `common_mistakes` du JSON de taxonomie. La cause racine n°1 listée
dans `docs/02-classification.md` §2 **ne s'applique pas ici**.

**b. Y a-t-il un seuil minimum ?**
Oui, `WEIGHTS.minScore = 3.0` (`lib/classifier.ts:195`). Mais il est très
au-dessous de ce qu'un seul terme rapporte : un mot-clé en titre vaut
`6 × 2,5 = 15`, une correspondance approximative sur une marque vaut
`8 × 0,6 × 2,5 = 12`. **Un unique terme parasite passe le seuil quatre fois.**
Le seuil ne protège de rien.

**c. Y a-t-il un fallback vers une catégorie par défaut ?**
**Non.** `detectCategory` renvoie `null` si `!result.success` ou si le mapping
`CATEGORY_MAP` ne connaît pas la sous-catégorie. La cause racine n°4 du brief ne
s'applique pas. C'est le point le plus sain du code actuel.

**d. Le matching est-il en `OR` sur les tokens ?**
**Oui**, et c'est la cause racine réelle. `_scoreWords()` additionne le score de
chaque mot indépendamment ; aucune notion de « nom-tête » n'existe. Un seul
token rare suffit à porter une catégorie, exactement le mécanisme décrit au §2
du brief.

**e. Les toponymes sont-ils exclus du scoring ?**
**Non.** Aucune liste de toponymes n'est consultée avant scoring, alors que le
projet possède `lib/cities.ts` (154 villes) et l'utilise déjà ailleurs.
Aggravant : la correspondance approximative (Levenshtein distance 1, poids × 0,6)
transforme les noms de villes en marques et modèles.

---

## 4. Reproduction du bug — cause racine

`npm run test:toponymes` — le test échoue en l'état, c'est voulu.

**Le symptôme exact « Appartement Cannes → Véhicule utilitaire » n'est pas
reproductible sur le code actuel.** Vérifié :

```
« Appartement Cannes »        → immobilier / Ventes immobilières (conf 0,76)
« Appartement Cannes 3 pièces »→ immobilier / Ventes immobilières (conf 1,00)
« Cannes » (seul)             → aucune catégorie
```

« appartement » est un mot-clé immobilier fort (15 points) et « Cannes » ne
ressemble à rien d'indexé. Soit le bug a été corrigé, soit il vient d'un autre
chemin de code, soit le titre observé différait.

**Le mécanisme, lui, est bien vivant et se démontre.** Sur les 154 villes de
`lib/cities.ts`, **24 produisent une catégorie à elles seules**, uniquement par
correspondance approximative :

```
« Lyon »           → VEHICULES / Voitures        (lyon → leon, modèle Seat)
« Fort-de-France » → VEHICULES / Voitures        (fort → ford, marque)
« Nice »           → MODE / Chaussures           (nice → nike, marque)
« Metz »           → ELECTRONIQUE / Consoles     (metz → meta, marque)
« Cholet »         → VACANCES / Locations sais.  (cholet → chalet)
« Chalon-sur-Saône»→ ANIMAUX / Chats             (chalon → chaton)
« Grasse »         → LOISIRS / Livres            (grasse → grasset, éditeur)
« Brive-la-G. »    → ANIMAUX / Autres animaux    (brive → bride)
… 16 autres
```

**« Lyon » et « Fort-de-France » sortent littéralement en catégorie Véhicules.**
C'est le bug rapporté, à un nom de ville près.

Il se déclenche dès que le titre n'a pas de nom-tête franc :

```
« Loue Nice »   → MODE / Chaussures            (le verbe « loue » ne pèse rien)
« Urgent Lyon » → VEHICULES / Voitures
« Vends Grasse »→ LOISIRS / Livres
« Dispo Metz »  → ELECTRONIQUE / Consoles
```

**Cause racine, en une phrase** : le scoring est une somme `OR` sur des tokens
indépendants, sans notion de nom-tête ni exclusion des toponymes, et la
correspondance approximative à distance 1 fabrique des preuves qui n'existent
pas — un nom de ville devient une marque automobile.

Les deux causes du brief qui s'appliquent sont donc **la n°2 (toponyme traité
comme mot-clé)** et **la n°3 (absence de seuil utile)**, aggravées par le fuzzy.
Les n°1 et n°4 ne s'appliquent pas.

Correction de principe, conforme à la règle « aucune règle spécifique à Cannes » :
neutraliser les toponymes avant scoring (la liste existe déjà), exiger un
nom-tête détecté ou un score sémantique très élevé pour rendre un type candidat,
et interdire au fuzzy seul de rendre un type éligible.

---

## 5. Points de rupture d'une bascule `attributes` + `listing_type_key`

### 5.1 Ce qui casse en lecture des colonnes typées

13 fichiers lisent `vehicleKm` / `vehicleYear` / `immoSurface` / `immoRooms` :

```
app/annonce/[id]/[slug]/page.tsx      lib/quality-score.ts
app/api/listings/route.ts             lib/search-where.ts
app/api/v1/listings/route.ts          lib/moderation.ts
components/listing/MarketEstimate.tsx lib/external-create.ts
lib/ai-search.ts                      mobile/app/annonce/[id].tsx
lib/opensearch-index.ts               mobile/app/recherche.tsx
lib/opensearch-search.ts              mobile/lib/listingSpecs.ts
```

Le brief impose « ajout uniquement, aucune colonne supprimée » : ces colonnes
deviennent donc des **projections dénormalisées** de `attributes`, maintenues en
écriture. Aucun de ces 13 fichiers n'a besoin d'être touché en Phase 1.

### 5.2 Recherche

- `lib/search-where.ts` construit un `where` Prisma sur colonnes typées + un
  `contains` texte sur `condition`. Les filtres dynamiques d'un ListingType
  n'ont **aucun équivalent** ici : `metadata` est du texte, non requêtable.
- `lib/opensearch-search.ts` / `lib/opensearch-index.ts` sont le seul chemin
  viable pour des filtres arbitraires. Le mapping devra passer en champs
  dynamiques (`attributes.*` en `flattened` ou objets typés par ListingType).
  **Réindexation complète obligatoire** (`npm run search:reindex`).
- `lib/filters-config.ts` code en dur les facettes par catégorie. Devient
  redondant avec `display` / `fields` du ListingType — à supprimer, pas à
  maintenir en double.

### 5.3 Écrans

- `app/post/PostForm.tsx` (2 276 l.) et `mobile/app/(tabs)/post.tsx` sont
  remplacés, pas modifiés.
- `app/annonce/[id]/edit/EditForm.tsx` (313 l.) doit être régénéré depuis la
  config **de la version épinglée** de l'annonce, sinon éditer une vieille
  annonce la casse.
- `app/annonce/[id]/[slug]/page.tsx` affiche des blocs codés en dur → à basculer
  sur `display.blocks`.
- Back-office : `app/admin/(protected)/crm/clients/AdminListingForm.tsx` et
  `app/admin/actions.ts` créent des annonces avec des champs figés. Ils
  écriraient des annonces invalides au regard de leur ListingType.

### 5.4 Endpoints

- `POST /api/listings` (760 l.) — pipeline lourd : modération, dédup, risque,
  pHash, OpenSearch, emails, saved searches. La validation par config doit
  s'insérer **avant** la modération, sans réécrire le pipeline.
- `POST /api/v1/listings` — API publique versionnée. Contrat externe : un
  `listing_type_key` obligatoire est un *breaking change*. À prévoir en optionnel
  avec inférence par défaut.
- `/api/taxonomy` — sert déjà catégories et régimes de champs au mobile. C'est
  le point d'entrée naturel des configs compilées.

### 5.5 Exports et jobs

- `app/api/feed/shopping/route.ts` — flux Google Shopping, mappe `condition` sur
  `new`/`used`. Les types non-produit (prestation, emploi) doivent en être exclus,
  ce qui n'est pas le cas aujourd'hui.
- Sitemap et pages SEO (`app/prix/[slug]`, `app/voiture/[slug]`,
  `lib/seo-content.ts`) supposent la taxonomie actuelle à 15 catégories. Le pack
  en propose 11 racines / 45 sous / ~200 types : **les URL changent**, donc
  redirections 301 obligatoires.
- `app/api/cron/listings/route.ts` — durée de vie 300 j, indépendant du type.
  Non impacté.

### 5.6 Le point de rupture le plus coûteux

**Deux taxonomies vont coexister.** Celle du code (`lib/categories.ts`,
15 catégories) et celle du pack (`config/taxonomy.roots.json`, 11 racines). Les
318 annonces existantes portent la première, en clair, dans la colonne
`category` (libellé, pas identifiant). Toute la recherche, le SEO et les filtres
en dépendent.

Il faut une **table de correspondance explicite ancienne → nouvelle**, versionnée
et testée, avant la moindre ligne de Phase 1. Sans elle, la Phase 7 est
impossible à réaliser sans casse.

---

## 6. Recommandation avant Phase 1

Trois écarts entre le pack et le terrain, à trancher avant de commencer :

1. **Le pack suppose « React Native + Node ».** Le projet est **Next.js App
   Router (site web, SSR, SEO) + Expo**. Le SEO n'est pas « à cadrer » comme le
   dit le brief : c'est déjà l'essentiel du trafic, avec des pages hub, un
   sitemap et des données structurées existants. `@dealco/config-core` doit être
   consommable par les Server Components, pas seulement par une API Node.

2. **Le pack ignore le moteur d'intention livré cette semaine.** `nature` et
   `fieldSet` recouvrent partiellement `listing_type_key`. Décider maintenant :
   `OfferNature` devient-elle un axe du ListingType, ou le ListingType
   l'absorbe-t-il ? Faire les deux en parallèle recrée exactement la duplication
   que les deux systèmes cherchent à supprimer.

3. **318 annonces.** Le pack est dimensionné pour un catalogue mature. À ce
   volume, la Phase 2 (classifieur) et la Phase 7 (migration) sont peu risquées ;
   les Phases 1, 3 et 4 représentent en revanche la réécriture des deux
   formulaires et de la page d'annonce. L'ordre proposé par le brief est bon,
   mais le gain immédiat est concentré sur la Phase 2 — corriger les toponymes
   coûte une journée et supprime un bug visible en production.

**Proposition : traiter la Phase 2 en premier**, indépendamment du reste. Elle
est autonome, testable (`npm run test:toponymes`), sans migration, et rend vert
le seul défaut du lot qui soit reproductible aujourd'hui.

---

Phase 1 non démarrée, conformément à la consigne « Ne passe pas en Phase 1 avant
d'avoir fait valider `AUDIT.md` ».

---

## 7. Phase 2 — faite

La Phase 2 a été traitée en premier, comme recommandé au §6 : autonome,
testable, sans migration, et elle supprime le seul défaut reproductible.

**Moteur** — `lib/listing-engine/` :

| Fichier | Rôle |
|---|---|
| `nodes.ts` | Registre des 228 nœuds de taxonomie, enrichis par les 8 configs du pack |
| `gazetteer.ts` | Reconnaissance d'entités : villes neutralisées, marques/modèles promus en preuve |
| `classify.ts` | Pipeline de scoring + garde-fous + décision `autoselect` / `confirm` / `ask` |

**Endpoint** — `POST /api/classify`, réponse toujours accompagnée de ses preuves.

**Tests** :

```
npm run test:classifier   12/12 cas du pack + non-régression toponymes
npm run test:toponymes    154 villes, aucune ne décide seule d'une catégorie
```

Le classifieur historique a été durci au passage, car c'est lui qui tourne
aujourd'hui sur le chemin de publication (`lib/autoCategory.ts`) :

1. toponymes retirés avant scoring — marques et modèles conservés, ce sont ses
   preuves les plus lourdes ;
2. une correspondance approximative seule ne décide plus rien ;
3. deux catégories au coude à coude ne sont plus départagées par l'ordre de
   priorité interne — « Canapé cuir » sortait en véhicule par ce biais ;
4. deux corrections de données : « urgent » n'est plus un synonyme d'offre
   d'emploi, « cuir » n'est plus un mot-clé de voiture. Ce sont des
   modificateurs, pas des noms-têtes.

**Écart assumé** : le terme sémantique de la formule (`0.25 · cos`) n'est pas
implémenté — pas d'embeddings de nœuds disponibles. Son absence rend le moteur
*plus strict*, jamais plus permissif : la seule voie vers l'éligibilité reste le
nom-tête. Un nœud qui serait passé par la similarité produit une question, pas
une erreur. À réintroduire quand les embeddings existeront.

**Écart assumé** : le gazetteer compte 154 villes (`lib/cities.ts`) au lieu des
35 000 communes INSEE prévues. Les indices touristiques ne sont connus que pour
les 6 villes du pack. Conséquence : hors de ces villes, l'ordre des options
d'une question de désambiguïsation est moins fin. **Aucune décision de catégorie
n'en dépend.**

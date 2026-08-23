# Note de déploiement — correctifs SEO du 23/08/2026

Pour la personne qui déploie. Quatre commits, tous sur `main`, aucun changement
de base de données, aucune variable d'environnement à ajouter.

## Ce qui part

| Commit | Effet visible |
|---|---|
| `fix(seo): stop writing the brand suffix twice` | Les titres perdent leur « \| Deal&Co » en double, sur les fiches annonces et 11 pages publiques |
| `fix(seo): return a real 308 on stale listing slugs` | Un slug périmé redirige (308) au lieu de répondre 200 avec « annonce introuvable » |
| `fix(seo): hide the sibling subcategory block…` | Un bloc de puces vide disparaît au lieu d'afficher son seul titre |
| `docs(seo): record the apex redirect as fixed` | Documentation |

## Le seul point qui mérite un œil

Le correctif du 308 **retire le squelette de chargement** des fiches annonces
(`app/annonce/[id]/[slug]/loading.tsx`). C'est ce retrait qui rend le code HTTP
possible : tant qu'une frontière Suspense existe sur ce segment, Next vide le
shell avant la redirection, qui se dégrade alors en redirection JavaScript
renvoyée avec un 200 — un soft 404.

Conséquence pour le visiteur : la page ne montre plus de squelette, elle arrive
d'un coup. Mesuré en local avant déploiement, TTFB 0,20 à 0,26 s, et les blocs
lourds de la page (annonces similaires, recommandations) gardent leurs propres
frontières Suspense.

**À surveiller après mise en ligne** : le TTFB des fiches annonces.

```bash
npm run seo:ttfb
```

Le script tire ses URL du sitemap servi, mesure fiches et pages de liste, et
sort en erreur si les fiches doublent la référence. Mesure du 23/08/2026, après
déploiement, depuis un poste extérieur :

```
fiches annonces    min 0.24s · médiane 0.28s · p90 0.34s · max 0.88s
pages de liste     min 0.20s · médiane 0.43s · p90 0.51s · max 0.61s
```

L'audit relevait jusqu'à 1,9 s sur les fiches contre 0,3 à 0,7 s sur les listes.
Le rapport est désormais inversé : les fiches répondent plus vite que les pages
de liste. C'est ce qui rend le retrait du squelette tenable — il n'y a plus
d'attente à masquer.

## Vérification, une fois déployé

```bash
# 1. Titre : une seule fois la marque
curl -s https://www.dealandcompany.fr/annonce/cmsp77kel000a04l8ozvkmu1k/montre-diesel-dz-7333 \
  | grep -o '<title>[^<]*'
# attendu : Montre diesel DZ-7333 à Gournay sur Marne — 130 € | Deal&Co

# 2. Slug périmé : 308, pas 200
curl -sI https://www.dealandcompany.fr/annonce/cmsp77kel000a04l8ozvkmu1k/slug-bidon-xyz \
  | grep -iE '^HTTP|^location'
# attendu : 308 + location vers .../montre-diesel-dz-7333

# 3. Identifiant inconnu : toujours 404
curl -so /dev/null -w '%{http_code}\n' https://www.dealandcompany.fr/annonce/inexistant/xyz
# attendu : 404
```

Et depuis le dépôt, avec accès à la base :

```bash
npm run seo:coverage    # sitemap sans anomalie
npm run seo:sublinks    # aucun lien interne vers une sous-catégorie en 404
```

## Retour arrière

Rien à défaire côté base : `git revert` du commit concerné suffit, chaque
correctif est indépendant. Pour retrouver le squelette de chargement sans perdre
le reste, il suffit de restaurer le seul fichier :

```bash
git checkout f87e28b^ -- 'app/annonce/[id]/[slug]/loading.tsx'
```

En le restaurant, le soft 404 revient : les deux ne peuvent pas coexister.

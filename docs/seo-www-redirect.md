# Redirection `dealandcompany.fr` → `www.dealandcompany.fr`

## Constat

Le crawl du 23/08/2026 a mesuré :

```
$ curl -I https://dealandcompany.fr/
HTTP/2 307
location: https://www.dealandcompany.fr/
server: Vercel
```

**307 = temporaire.** Google conserve alors l'URL sans `www` dans son index,
n'y transfère pas le signal accumulé, et revient vérifier les deux versions
indéfiniment. Sur un domaine jeune, l'autorité reste coupée en deux pour rien —
le comportement pour le visiteur, lui, est identique en 307 et en 308.

## Pourquoi le correctif n'est pas entièrement dans ce dépôt

La réponse ne porte aucun en-tête de l'application (`content-type: text/plain`,
pas de CSP, pas de `x-nextjs-*`) : elle est émise par l'edge Vercel **avant**
que la requête n'atteigne le code. C'est la configuration *domaine* du projet,
et elle ne se déclare ni dans `vercel.json`, ni dans `next.config.ts`.

Ce dépôt pose malgré tout la règle permanente dans `next.config.ts` — voir le
bloc `has: [{ type: "host", value: "dealandcompany.fr" }]`. Elle prend le relais
si l'apex est un jour servi par le projet au lieu d'être redirigé à l'edge, et
elle rend l'application correcte sur tout autre hébergement.

## Ce qu'il reste à faire, dans le compte qui détient le domaine

Le compte Vercel connecté sur ce poste (`V's projects`) n'a pas accès au
domaine : la manip doit être faite depuis celui qui l'héberge.

### Par l'interface

1. Projet → **Settings** → **Domains** ;
2. ligne `dealandcompany.fr` (celle marquée *Redirect to www.dealandcompany.fr*) → **Edit** ;
3. cocher **Permanent redirect (308)**, enregistrer.

### Par l'API, si l'interface n'est pas disponible

```bash
curl -X PATCH \
  "https://api.vercel.com/v9/projects/prj_UfPgu96TX63ErBiTmwUDe5jneZgL/domains/dealandcompany.fr" \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"redirect":"www.dealandcompany.fr","redirectStatusCode":308}'
```

L'identifiant de projet est celui de `.vercel/project.json`. Le jeton doit
appartenir au compte propriétaire du domaine.

## Vérification

```bash
curl -sI https://dealandcompany.fr/            | head -3   # attendu : 308
curl -sI https://dealandcompany.fr/annonces    | head -3   # attendu : 308 vers www
curl -sI https://www.dealandcompany.fr/        | head -3   # attendu : 200
```

Le chemin doit être conservé dans la redirection : `dealandcompany.fr/annonces`
doit mener à `www.dealandcompany.fr/annonces`, pas à la page d'accueil. Une
redirection qui écrase le chemin est aussi coûteuse qu'un 404 pour les liens
entrants profonds.

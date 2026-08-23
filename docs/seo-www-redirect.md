# Redirection `dealandcompany.fr` → `www.dealandcompany.fr`

> **État au 23/08/2026 : corrigé.** Le domaine du projet Vercel a été basculé en
> redirection permanente, et l'edge sert bien un 308 en conservant le chemin.
> Ce document garde le raisonnement et la procédure — la même bascule sera à
> refaire si un domaine est ajouté un jour.

## Constat d'origine

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

## La bascule, dans le compte qui détient le domaine

Faite le 23/08/2026. Le compte Vercel connecté sur le poste de développement
(`V's projects`) n'a pas accès au domaine : la manip se fait depuis celui qui
l'héberge.

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
curl -sD - -o /dev/null https://dealandcompany.fr/ | grep -iE '^HTTP|^location'
```

Mesure du 23/08/2026, après bascule :

```
HTTP/2 308
location: https://www.dealandcompany.fr/
```

**Le chemin doit être conservé.** `dealandcompany.fr/annonces/maison` doit mener
à `www.dealandcompany.fr/annonces/maison`, pas à la page d'accueil : une
redirection qui écrase le chemin coûte autant qu'un 404 sur tous les liens
entrants profonds, et c'est le défaut le plus courant de ce type de réglage.
Vérifié sur trois profondeurs — racine, page de liste, fiche annonce — les trois
conservent leur chemin.

## Reste ouvert, sans rapport avec la redirection

L'interface Vercel signale « DNS Change Recommended » sur les deux entrées :
elle recommande `A @ 216.150.1.1` et `CNAME www → 75a3fac3d8e6c6da.vercel-dns-017.com`.
C'est une extension de plage d'adresses, pas une panne — Vercel précise que les
enregistrements actuels (`cname.vercel-dns.com`, `76.76.21.21`) continuent de
fonctionner. Aucun effet SEO tant que les deux domaines répondent ; à faire au
prochain passage sur le registrar, pas en urgence.

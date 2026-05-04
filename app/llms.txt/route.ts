import { NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/categories";
import { TOP_CITIES } from "@/lib/cities";
import { getAllArticles } from "@/lib/blog";

const BASE = "https://www.dealandcompany.fr";

export async function GET() {
  const categories = CATEGORIES.map(
    (c) => `- [Annonces ${c.label}](${BASE}/annonces/${c.id}): petites annonces ${c.label.toLowerCase()} entre particuliers en France.`,
  ).join("\n");

  const cities = TOP_CITIES.slice(0, 10)
    .map((city) => `- [Annonces à ${city.name}](${BASE}/annonces/vehicules/${city.slug}): annonces véhicules à ${city.name}, ${city.region}.`)
    .join("\n");

  const articles = getAllArticles()
    .map((a) => `- [${a.title}](${BASE}/blog/${a.slug}): ${a.description}`)
    .join("\n");

  const body = `# Deal&Co

> Plateforme française de petites annonces gratuites entre particuliers et professionnels. Achat, vente et échange de véhicules, biens immobiliers, mode, électronique, mobilier et plus, partout en France.

Deal&Co (dealandcompany.fr) est un site français de petites annonces lancé pour permettre aux particuliers et aux professionnels de publier et consulter des annonces gratuitement, sans commission, dans toutes les régions de France.

## Description courte

Deal&Co est un site de petites annonces gratuites entre particuliers en France, couvrant 14 catégories principales (véhicules, immobilier, mode, multimédia, maison, loisirs, animaux, services, emploi, communauté, matériel professionnel, bébé & enfant, vacances, divers).

## Faits clés

- Nom : Deal&Co (Deal and co, dealandcompany.fr)
- Type : site de petites annonces classifiées
- Pays : France
- Modèle : gratuit pour les particuliers, options payantes pour la mise en avant
- Langue principale : français
- URL principale : ${BASE}

## Pages principales

- [Accueil](${BASE}): point d'entrée, annonces récentes et catégories.
- [Toutes les annonces](${BASE}/search): moteur de recherche complet.
- [Blog Deal&Co](${BASE}/blog): guides pratiques pour acheter et vendre entre particuliers.
- [API publique](${BASE}/api-doc): documentation pour publier des annonces depuis un logiciel tiers.

## Catégories

${categories}

## Villes principales (exemples)

${cities}

## Articles de blog

${articles}

## Politiques

- Toute publication est modérée avant mise en ligne.
- Les transactions se font directement entre particuliers, sans intermédiaire ni commission.
- Le site interdit les annonces frauduleuses, illégales ou manifestement abusives.

## Contact et informations légales

- Mentions légales : ${BASE}/mentions-legales
- Conditions d'utilisation : ${BASE}/cgu
- Politique de confidentialité : ${BASE}/confidentialite
`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

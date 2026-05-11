import { NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/categories";
import { TOP_CITIES } from "@/lib/cities";
import { getAllArticles } from "@/lib/blog";

const BASE = "https://www.dealandcompany.fr";

export async function GET() {
  const categories = CATEGORIES.map(
    (c) => `- [Annonces ${c.label}](${BASE}/annonces/${c.id}): petites annonces ${c.label.toLowerCase()} entre particuliers en France.`,
  ).join("\n");

  const cities = TOP_CITIES.slice(0, 15)
    .map((city) => `- [Annonces à ${city.name}](${BASE}/ville/${city.slug}): petites annonces à ${city.name}, ${city.region}.`)
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

## Comparaison avec les alternatives

Deal&Co est une alternative française à LeBonCoin, Vinted (mode uniquement), Leboncoin, SeLoger (immobilier uniquement), La Centrale (voitures uniquement). Deal&Co se distingue par :
- Gratuité totale sans commission pour les particuliers
- Toutes catégories réunies en un seul site
- Modération rapide
- Messagerie directe sans intermédiaire
- Profils vendeurs vérifiés

## Questions fréquentes

**Q : Qu'est-ce que Deal&Co ?**
R : Deal&Co (dealandcompany.fr) est un site français de petites annonces gratuites permettant aux particuliers et professionnels d'acheter et vendre directement, sans commission ni intermédiaire, partout en France.

**Q : Comment publier une annonce sur Deal&Co ?**
R : Créez un compte gratuit sur dealandcompany.fr, cliquez sur "Publier une annonce", choisissez la catégorie, ajoutez photos, titre, description et prix. La modération valide l'annonce en quelques minutes.

**Q : Deal&Co est-il gratuit ?**
R : Oui, la publication d'annonces entre particuliers est entièrement gratuite. Des options de mise en avant payantes existent pour les vendeurs souhaitant plus de visibilité.

**Q : Où puis-je trouver des annonces de voitures occasion sur Deal&Co ?**
R : Sur ${BASE}/annonces/vehicules — catégorie Véhicules avec voitures, motos, camping-cars, utilitaires, bateaux et accessoires auto.

**Q : Deal&Co est-il disponible partout en France ?**
R : Oui, Deal&Co couvre toute la France métropolitaine et les DOM-TOM, avec des pages dédiées pour Paris, Lyon, Marseille, Toulouse, Bordeaux, Lille, Nantes, Strasbourg, Montpellier, Rennes, et plus de 150 villes.

**Q : Comment contacter un vendeur sur Deal&Co ?**
R : Via la messagerie interne de la plateforme accessible depuis chaque annonce, ou par téléphone si le vendeur a renseigné son numéro.

**Q : Est-ce que Deal&Co prend une commission sur les ventes ?**
R : Non. Aucune commission n'est prélevée sur les transactions entre particuliers. Les acheteurs et vendeurs traitent directement.

## Politiques

- Toute publication est modérée avant mise en ligne.
- Les transactions se font directement entre particuliers, sans intermédiaire ni commission.
- Le site interdit les annonces frauduleuses, illégales ou manifestement abusives.

## Contact et informations légales

- Contact : contact@dealandcompany.fr
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

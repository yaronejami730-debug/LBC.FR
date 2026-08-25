/**
 * Vérifications de la veille presse — parties pures, sans base ni réseau.
 *
 * Ce qui est testé ici est exactement ce qui peut se voir de l'extérieur : un
 * flux mal lu, ou un titre rattaché au mauvais modèle. Le reste du système
 * (cache, upsert, cron) n'a pas de comportement propre à vérifier.
 */
import { parseFeed, youtubeIdOf, EXCERPT_CHARS } from "../lib/news/parse";
import {
  detectBrand,
  detectModel,
  matchTitle,
  BRAND_ALIAS_TARGETS,
  KNOWN_BRAND_SLUGS,
  type ModelCatalogue,
} from "../lib/news/match";
import {
  isExcludedCategory,
  NEWS_SOURCES,
  MAX_AGE_DAYS,
  SECTIONS,
  INFO_SECTIONS,
  AUTO_SECTION,
  sourceKeysOfKind,
  sourceKeysOfSection,
} from "../lib/news/sources";
import { brandModelFromPriceSlug } from "../lib/news/select";
import { extractArticleText, boundedQuote } from "../lib/news/fulltext";
import { check, equal, section, report } from "./test-helpers";

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Motor1 France</title>
  <item>
    <title><![CDATA[Essai Renault Clio 5 : toujours la reine ?]]></title>
    <link>https://fr.motor1.com/reviews/essai-renault-clio-5/</link>
    <pubDate>Mon, 18 Aug 2026 09:30:00 +0200</pubDate>
    <description><![CDATA[<p>La <b>Clio</b> reste la plus vendue.</p>]]></description>
    <category>Essais</category>
    <category>Renault</category>
    <enclosure type="image/jpeg" length="21966" url="https://cdn.motor1.com/images/mgl/1Zw3kL/s3/clio.jpg"/>
  </item>
  <item>
    <title>Peugeot 3008 &amp; 5008 : les prix grimpent</title>
    <link>https://fr.motor1.com/news/peugeot-3008-prix/</link>
    <pubDate>Sun, 17 Aug 2026 07:00:00 +0200</pubDate>
    <description>Hausse tarifaire.</description>
    <category>Actualités</category>
  </item>
  <item>
    <title>Article sans date</title>
    <link>https://fr.motor1.com/news/sans-date/</link>
  </item>
  <item>
    <title>Lien piégé</title>
    <link>javascript:alert(1)</link>
    <pubDate>Sun, 17 Aug 2026 07:00:00 +0200</pubDate>
  </item>
</channel></rss>`;

section("Lecture du flux");
const items = parseFeed(FEED);
equal("les items exploitables sont retenus", items.length, 2);
equal("le CDATA est retiré du titre", items[0].title, "Essai Renault Clio 5 : toujours la reine ?");
equal("les entités sont décodées", items[1].title, "Peugeot 3008 & 5008 : les prix grimpent");
equal("le HTML du résumé est réduit à du texte", items[0].summary, "La Clio reste la plus vendue.");
check("les rubriques sont conservées", items[0].categories.join(",") === "Essais,Renault");
equal("la date est lue", items[0].publishedAt.toISOString().slice(0, 10), "2026-08-18");
check(
  "un item sans date est écarté plutôt que daté d'aujourd'hui",
  items.every((i) => i.title !== "Article sans date"),
);
check(
  "un lien non http est écarté",
  items.every((i) => !i.url.startsWith("javascript:")),
);

section("Rubriques écartées");
check("un contenu sponsorisé est écarté", isExcludedCategory(["Sponsorisé"]));
check("une rubrique normale passe", !isExcludedCategory(["Essais", "Renault"]));

section("Signature du flux");
const AVEC_AUTEUR = `<rss version="2.0"><channel><item>
  <title>Orages : une tornade s'abat sur l'Aude</title>
  <link>https://www.20minutes.fr/faits_divers/4240756-orages/</link>
  <pubDate>Mon, 24 Aug 2026 18:44:45 GMT</pubDate>
  <description>A Pomas, des toitures ont été arrachées.</description>
  <author>C. A. avec AFP</author>
  <body><![CDATA[<p>Le corps complet de l'article, qui ne doit jamais être repris.</p>]]></body>
  <enclosure url="https://img.20mn.fr/abc/1200x768_tornade" type="image/jpeg" length="0"/>
</item></channel></rss>`;
const avecAuteur = parseFeed(AVEC_AUTEUR);
equal("la signature du flux est lue", avecAuteur[0].author, "C. A. avec AFP");
// La citation est bornée : un corps long en ressort tronqué, jamais entier.
const LONG = AVEC_AUTEUR.replace(
  "<p>Le corps complet de l'article, qui ne doit jamais être repris.</p>",
  "<p>" + "Phrase de remplissage bien réelle. ".repeat(60) + "</p>",
);
equal("le résumé reste le chapô du flux", avecAuteur[0].summary, "A Pomas, des toitures ont été arrachées.");
// Un corps de deux lignes n'est pas un corps d'article : il est refusé, et
// c'est ce refus qui déclenche la lecture de la page du média à la captation.
check("un corps trop court ne donne pas de citation", avecAuteur[0].excerpt === null);
const longs = parseFeed(LONG);
check("un corps de vraie longueur donne une citation", (longs[0].excerpt ?? "").length > 0);
check("la citation ne dépasse jamais la borne", longs.every((i) => (i.excerpt ?? "").length <= EXCERPT_CHARS + 6));
// La cible affichée : une quinzaine de lignes, pas sept. C'est le reproche
// exact qui a fait relever la borne de 30 % à 45 %.
check("la citation d'un long article tient une quinzaine de lignes", (longs[0].excerpt ?? "").length >= 900);
// Les paragraphes du média sont conservés : une citation de quinze lignes
// rendue en un seul bloc est un mur que personne ne lit.
const MULTI = AVEC_AUTEUR.replace(
  "<p>Le corps complet de l'article, qui ne doit jamais être repris.</p>",
  "<p>" + "Premier paragraphe bien réel. ".repeat(20) + "</p><p>" + "Second paragraphe bien réel. ".repeat(20) + "</p>",
);
check("les paragraphes du média sont conservés", (parseFeed(MULTI)[0].excerpt ?? "").includes("\n"));
check("un flux sans corps ne fabrique pas de citation", items[0].excerpt === null);
check("aucune signature là où le flux n'en publie pas", items[0].author === null);

section("Rubriques");
check(
  "chaque flux déclare une rubrique connue",
  NEWS_SOURCES.every((s) => SECTIONS.some((sec) => sec.slug === s.section)),
);
check(
  "chaque rubrique a au moins un flux",
  SECTIONS.every((sec) => sourceKeysOfSection(sec.slug).length > 0),
);
check(
  "l'auto ne figure pas dans les rubriques de Deal&Co Info",
  // Comparaison élargie volontairement : les types prouvent déjà que ces deux
  // ensembles ne se croisent pas, et TypeScript refuse la comparaison stricte.
  // La garder à l'exécution protège du jour où quelqu'un élargira le type.
  !INFO_SECTIONS.some((s) => (s.slug as string) === AUTO_SECTION),
);
check(
  "les deux univers ne partagent aucun flux",
  sourceKeysOfSection(AUTO_SECTION).every(
    (k) => !sourceKeysOfSection(INFO_SECTIONS.map((s) => s.slug)).includes(k),
  ),
);

section("Nature des flux");
check(
  "chaque flux déclare une nature connue",
  NEWS_SOURCES.every((s) => ["actualite", "essai", "video"].includes(s.kind)),
);
check(
  "un essai vit plus longtemps qu'une actualité",
  MAX_AGE_DAYS.essai > MAX_AGE_DAYS.actualite,
);
check("les deux natures sont représentées", sourceKeysOfKind("actualite").length > 0 && sourceKeysOfKind("essai").length > 0);
check(
  "aucune clé de flux n'est dupliquée",
  new Set(NEWS_SOURCES.map((s) => s.key)).size === NEWS_SOURCES.length,
);

section("Lecture Atom — flux de chaîne YouTube");
const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>Motor1 France</title>
 <entry>
  <yt:videoId>bdThICk4GNc</yt:videoId>
  <title>Maserati MCXtrema : un véhicule unique à plus d'un titre</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=bdThICk4GNc"/>
  <published>2026-01-28T09:51:18+00:00</published>
  <media:group>
   <media:thumbnail url="https://i3.ytimg.com/vi/bdThICk4GNc/hqdefault.jpg" width="480" height="360"/>
   <media:description>La Maserati MCXtrema est une voiture unique à tous points de vue.</media:description>
  </media:group>
 </entry>
</feed>`;
const videos = parseFeed(ATOM);
equal("une entrée Atom est lue", videos.length, 1);
equal("le lien alternate fait l'adresse", videos[0].url, "https://www.youtube.com/watch?v=bdThICk4GNc");
equal("la miniature est reprise", videos[0].imageUrl, "https://i3.ytimg.com/vi/bdThICk4GNc/hqdefault.jpg");
check("la description vient de media:description", (videos[0].summary ?? "").startsWith("La Maserati MCXtrema"));
equal("l'identifiant de vidéo est extrait", youtubeIdOf(videos[0].url), "bdThICk4GNc");
check("un hôte étranger ne devient jamais une vidéo", youtubeIdOf("https://exemple.fr/watch?v=bdThICk4GNc") === null);
check("une adresse sans identifiant valide est refusée", youtubeIdOf("https://www.youtube.com/watch?v=trop-court") === null);

section("Photo du flux");
equal("l'enclosure image est reprise", items[0].imageUrl, "https://cdn.motor1.com/images/mgl/1Zw3kL/s3/clio.jpg");
check("un item sans enclosure n'a pas de photo inventée", items[1].imageUrl === null);

section("Reconnaissance de la marque");
equal("marque simple", detectBrand("Essai Renault Clio 5")?.slug, "renault");
equal("marque en deux mots", detectBrand("L'Alfa Romeo Junior arrive")?.slug, "alfa-romeo");
equal("alias de la presse : VW", detectBrand("La VW Golf restylée")?.slug, "volkswagen");
equal("marque accentuée", detectBrand("Citroën C3 : le retour")?.slug, "citroen");
check("aucune marque dans un titre général", detectBrand("Le marché de l'occasion recule") === null);
check(
  "une marque courte ne se déclenche pas dans un mot",
  detectBrand("Nouvelle offre de seating premium") === null,
);

section("Cohérence du catalogue de marques");
for (const target of BRAND_ALIAS_TARGETS) {
  // Un alias qui pointe vers une marque inexistante échoue en silence : la
  // reconnaissance ne trouve rien et personne ne s'en aperçoit. C'est arrivé
  // avec « mercedes » pointant vers une marque nommée « Mercedes-Benz ».
  check(`l'alias vers « ${target} » désigne une marque connue`, KNOWN_BRAND_SLUGS.has(target));
}
equal("« Mercedes » sans « Benz » est reconnu", detectBrand("Le patron de Mercedes s'exprime")?.slug, "mercedes-benz");

section("Marques dont le nom est un mot courant");
check(
  "« cette mini tout-terrain » ne parle pas de la marque Mini",
  detectBrand("Devenez un héros, achetez cette mini tout-terrain") === null,
);
equal("« la Mini Cooper » parle bien de la marque", detectBrand("La Mini Cooper S restylée")?.slug, "mini");
check("« place assise » ne parle pas de Seat", detectBrand("Un siège avec seat massant") === null);
equal("« Seat Ibiza » parle bien de Seat", detectBrand("Seat Ibiza essence (2026)")?.slug, "seat");

section("Reconnaissance du modèle — seulement ce que nous avons en base");
const catalogue: ModelCatalogue = new Map([
  ["renault", [{ slug: "clio", label: "Clio" }, { slug: "megane", label: "Mégane" }]],
  ["bmw", [{ slug: "serie-3", label: "Série 3" }, { slug: "3", label: "3" }]],
  ["peugeot", [{ slug: "3008", label: "3008" }]],
]);
equal("modèle présent au catalogue", detectModel("Essai Renault Clio 5", "renault", catalogue)?.slug, "clio");
check(
  "un modèle absent du catalogue n'est pas inventé",
  detectModel("Renault Rafale : premier contact", "renault", catalogue) === null,
);
equal(
  "la correspondance la plus longue gagne",
  detectModel("La BMW Série 3 restylée", "bmw", catalogue)?.slug,
  "serie-3",
);
equal("marque sans modèle reconnu reste rattachée à la marque", matchTitle("Renault dévoile un concept", catalogue).brandSlug, "renault");
check("… et n'invente pas de modèle", matchTitle("Renault dévoile un concept", catalogue).modelSlug === null);
check(
  "un titre sans marque n'est rattaché à rien",
  matchTitle("Le marché de l'occasion recule", catalogue).brandSlug === null,
);

section("Slug de page de cote");
equal("marque", brandModelFromPriceSlug("renault-clio-occasion")?.brandSlug, "renault");
equal("modèle", brandModelFromPriceSlug("renault-clio-occasion")?.modelSlug, "clio");
equal("marque en deux mots", brandModelFromPriceSlug("alfa-romeo-giulia-occasion")?.brandSlug, "alfa-romeo");
equal("… et son modèle", brandModelFromPriceSlug("alfa-romeo-giulia-occasion")?.modelSlug, "giulia");
check("slug sans marque connue", brandModelFromPriceSlug("tondeuse-thermique-occasion") === null);

section("Lecture de la page d'un article");
// Voie 1 : le média désigne lui-même son texte dans un balisage schema.org.
// C'est la source la plus sûre, et elle est essayée en premier.
const PHRASE = "Une phrase d'article parfaitement ordinaire et bien réelle. ";
const AVEC_LD = `<html><head><script type="application/ld+json">${JSON.stringify({
  "@type": "NewsArticle",
  headline: "Un titre",
  articleBody: PHRASE.repeat(30),
})}</script></head><body><p>Menu</p></body></html>`;
check("le texte désigné par le média est retenu", (extractArticleText(AVEC_LD) ?? "").startsWith("Une phrase"));

// Voie 2 : les paragraphes d'un conteneur d'article explicite.
const AVEC_ARTICLE = `<html><body><nav><p>Accueil Rubriques Contact</p></nav><article>
  <p>${PHRASE.repeat(5)}</p><p>${PHRASE.repeat(5)}</p></article></body></html>`;
check("les paragraphes d'un <article> sont retenus", (extractArticleText(AVEC_ARTICLE) ?? "").length > 300);

// Ce qui n'est pas un article ne doit rien produire : mieux vaut le chapô du
// flux qu'un morceau de menu présenté comme une citation.
check("une page sans article ne produit rien", extractArticleText("<html><body><p>Cookies</p></body></html>") === null);
check("les scripts ne finissent jamais dans la citation", !(extractArticleText(AVEC_ARTICLE) ?? "").includes("<"));

// La borne est la même que pour un corps livré par un flux : d'où qu'il
// vienne, un texte n'est jamais repris au-delà de sa proportion.
const court = "Phrase courte et bien réelle. ".repeat(10); // ~290 caractères
check("un texte court n'est jamais repris en entier", (boundedQuote(court) ?? "").length < court.length);
const long = PHRASE.repeat(80); // ~4 600 caractères
check("un long article plafonne à la borne absolue", (boundedQuote(long) ?? "").length <= EXCERPT_CHARS + 6);
check("… et tient une quinzaine de lignes", (boundedQuote(long) ?? "").length >= 1200);

report("Veille presse");

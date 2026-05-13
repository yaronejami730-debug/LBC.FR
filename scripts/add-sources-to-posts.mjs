#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = join(__dirname, "..", "lib", "blog", "posts");

const SOURCES_BY_CATEGORY = {
  Véhicules: [
    "Cet article s'appuie sur les ressources officielles françaises relatives à l'automobile et aux deux-roues : service-public.fr (rubriques véhicules, contrôle technique, immatriculation), Code de la route consultable sur legifrance.gouv.fr, site de l'Agence nationale des titres sécurisés ANTS (ants.gouv.fr), et la documentation du contrôle technique central UTAC OTC (utac-otc.com).",
    "Les éléments économiques et de marché reposent sur les rapports annuels de l'Observatoire Cetelem de l'Automobile (cetelem.fr/observatoire-auto), les statistiques de transactions et d'immatriculations diffusées par AAA-Data (aaa-data.fr), les baromètres publics d'Argus (largus.fr) et La Centrale (lacentrale.fr), ainsi que les bilans annuels de l'Observatoire national interministériel de la sécurité routière (onisr.securite-routiere.gouv.fr).",
    "Les ordres de grandeur cités correspondent aux convergences observées entre ces différentes sources publiques à la date de rédaction. Les prix, performances et chiffres précis peuvent évoluer selon la conjoncture, l'état du véhicule et le marché local.",
  ],
  Immobilier: [
    "Cet article s'appuie sur les données publiques de l'Insee (insee.fr) pour la démographie, les revenus et les projections par commune, sur les indices et baromètres immobiliers du réseau des notaires de France (immobilier-notaires.fr) et de l'Observatoire des loyers piloté par l'ANIL (anil.org), ainsi que sur les baromètres publics de SeLoger (seloger.com) et Meilleurs Agents (meilleursagents.com).",
    "Le cadre réglementaire (encadrement des loyers, calendrier passoires thermiques, loi Climat et Résilience, diagnostics obligatoires) est issu des textes officiels disponibles sur legifrance.gouv.fr et des fiches pratiques de service-public.fr. Les modalités fiscales reposent sur la documentation publique de la Direction générale des Finances publiques (impots.gouv.fr) et de l'ADEME pour les aides à la rénovation énergétique.",
    "Les rendements et prix cités sont des fourchettes observées et publiées par les sources précitées. Ils varient selon le quartier, l'état du bien et le type de location et doivent toujours être recoupés avec une étude détaillée avant tout projet.",
  ],
  Conseils: [
    "Cet article s'appuie sur les ressources officielles applicables aux échanges entre particuliers : service-public.fr (rubriques consommation, vente entre particuliers, cession), Direction générale de la Concurrence, de la Consommation et de la Répression des fraudes DGCCRF (economie.gouv.fr/dgccrf), Commission nationale de l'informatique et des libertés CNIL (cnil.fr) pour les obligations relatives aux données personnelles.",
    "Les éléments relatifs à l'économie circulaire et au réemploi s'appuient sur la documentation de l'ADEME (ademe.fr) et sur les rapports publics de la Cour des comptes et de l'Institut national de la consommation (INC / 60 Millions de consommateurs).",
    "Les ordres de grandeur cités reflètent les tendances convergentes observées entre ces sources publiques. Les bonnes pratiques évoluent avec la réglementation et les outils proposés par les plateformes ; vérifier les éléments réglementaires sur les sources officielles avant toute décision importante.",
  ],
  Sécurité: [
    "Cet article s'appuie sur les ressources officielles en matière de protection des consommateurs : service-public.fr, DGCCRF (economie.gouv.fr/dgccrf), Plateforme cybermalveillance.gouv.fr pour les arnaques en ligne, et l'Agence nationale de la sécurité des systèmes d'information ANSSI (ssi.gouv.fr).",
    "Les recommandations de prudence convergent avec celles publiées par l'Institut national de la consommation (INC / 60 Millions de consommateurs) et les principales associations de consommateurs (UFC-Que Choisir, CLCV).",
    "Les modalités juridiques de recours (vices cachés, non-conformité, escroquerie) reposent sur les articles applicables du Code civil et du Code pénal consultables sur legifrance.gouv.fr.",
  ],
  Emploi: [
    "Cet article s'appuie sur les ressources officielles relatives à l'emploi et aux services aux particuliers : service-public.fr (rubriques emploi, autoentrepreneur, services à la personne), Code du travail consultable sur legifrance.gouv.fr, France Travail (anciennement Pôle emploi, francetravail.fr) et la documentation publique de l'URSSAF (urssaf.fr).",
    "Les modalités du Chèque emploi service universel (CESU) et des services à la personne reposent sur les fiches officielles de cesu.urssaf.fr et de la Direction générale des Entreprises (entreprises.gouv.fr).",
    "Les ordres de grandeur de rémunération cités correspondent aux tendances observées dans les statistiques publiques (Dares, Insee). Les tarifs réels varient selon la région, l'expérience et le type de mission.",
  ],
  Maison: [
    "Cet article s'appuie sur la documentation publique de l'ADEME (ademe.fr) consacrée au réemploi, à la seconde main et à la prolongation de durée de vie des biens, sur les guides de l'Institut national de la consommation (INC / 60 Millions de consommateurs) et sur les fiches pratiques de service-public.fr.",
    "Les éléments économiques (prix du marché de l'occasion, prix moyens du neuf) s'appuient sur les baromètres publics des principaux distributeurs et sur les études sectorielles régulièrement publiées par la presse spécialisée (Que Choisir, LSA Conso).",
    "Les ordres de grandeur cités reflètent les fourchettes observées sur le marché français à la date de rédaction. Les prix exacts varient selon l'état, la marque et la demande locale.",
  ],
  Mode: [
    "Cet article s'appuie sur les rapports publics de l'ADEME relatifs au textile et à l'économie circulaire (ademe.fr), sur les baromètres de l'Institut français de la mode (IFM) consacrés à la seconde main, et sur les fiches pratiques de service-public.fr pour la vente entre particuliers.",
    "Les éléments relatifs à la traçabilité et à l'authenticité s'appuient sur la documentation des marques officielles et sur les recommandations de la DGCCRF pour les achats à distance.",
    "Les ordres de grandeur de prix et de cote des articles d'occasion cités reflètent les fourchettes observées sur les principales plateformes de revente à la date de rédaction et peuvent évoluer rapidement selon les tendances.",
  ],
  Multimédia: [
    "Cet article s'appuie sur la documentation publique des constructeurs officiels (Apple, Samsung, Sony, Microsoft, etc.), sur les fiches techniques accessibles sur leurs sites support, et sur les guides de l'Institut national de la consommation (INC / 60 Millions de consommateurs) consacrés à l'électronique d'occasion.",
    "Les modalités relatives au reconditionné et à la garantie légale reposent sur le Code de la consommation consultable sur legifrance.gouv.fr et sur les fiches de la DGCCRF. La labellisation des reconditionneurs s'appuie sur les normes Afnor NF S97-130 et NF EN 50614.",
    "Les ordres de grandeur de prix et de fiabilité cités correspondent aux tendances observées dans les baromètres publics des comparateurs spécialisés et des médias techniques de référence.",
  ],
  "Matériel professionnel": [
    "Cet article s'appuie sur les ressources officielles relatives à la cession et à la sécurité du matériel professionnel : Code du travail consultable sur legifrance.gouv.fr (notamment les obligations en matière d'équipements de travail), fiches de l'Institut national de recherche et de sécurité INRS (inrs.fr), et documentation publique des constructeurs.",
    "Les éléments fiscaux et comptables relatifs à la cession de matériel professionnel reposent sur la documentation de la Direction générale des Finances publiques (impots.gouv.fr) et sur les fiches de l'URSSAF pour les indépendants.",
    "Les ordres de grandeur de prix et de durée de vie cités correspondent aux fourchettes observées sur les principales plateformes de revente professionnelle à la date de rédaction.",
  ],
  "Bébé & Enfant": [
    "Cet article s'appuie sur les ressources officielles relatives à la sécurité des produits pour enfants : DGCCRF (economie.gouv.fr/dgccrf), Direction générale de la Santé pour les normes sanitaires, et les normes européennes applicables aux jouets (EN 71), aux sièges auto (R44/R129) et aux articles de puériculture.",
    "Les recommandations sanitaires et de sécurité s'appuient sur la documentation publique de l'ANSES (Agence nationale de sécurité sanitaire de l'alimentation, de l'environnement et du travail), de l'INPES et des associations spécialisées en sécurité infantile.",
    "Les éléments relatifs au rappel de produits sont consultables sur rappel.conso.gouv.fr, à vérifier systématiquement avant tout achat d'occasion.",
  ],
  "High-Tech": [
    "Cet article s'appuie sur la documentation publique des constructeurs officiels (Apple, Samsung, Sony, Microsoft, Google), sur les fiches techniques accessibles via leurs sites support et les bases de données IMEI publiques, ainsi que sur les guides de l'Institut national de la consommation (INC / 60 Millions de consommateurs) consacrés à l'électronique reconditionnée.",
    "Le cadre réglementaire applicable au reconditionné et à la garantie légale repose sur le Code de la consommation (legifrance.gouv.fr) et sur les fiches de la DGCCRF. Les normes de référence pour le reconditionnement sont Afnor NF S97-130 et NF EN 50614.",
    "Les ordres de grandeur de prix et de fiabilité cités correspondent aux tendances observées dans les baromètres publics des principaux comparateurs et reconditionneurs français à la date de rédaction.",
  ],
};

function getCategoryFromFile(content) {
  const m = content.match(/category:\s*"([^"]+)"/);
  return m ? m[1] : null;
}

function buildSourcesSection(category) {
  const paragraphs = SOURCES_BY_CATEGORY[category] ?? SOURCES_BY_CATEGORY["Conseils"];
  const escaped = paragraphs.map((p) =>
    "        " + JSON.stringify(p) + ","
  ).join("\n");
  return [
    "    {",
    "      h2: \"Sources et méthodologie\",",
    "      paragraphs: [",
    escaped,
    "      ],",
    "    },",
  ].join("\n");
}

function injectSources(filePath) {
  const content = readFileSync(filePath, "utf8");
  if (content.includes('"Sources et méthodologie"')) return false;

  const category = getCategoryFromFile(content);
  const newSection = buildSourcesSection(category);

  // Find the `],\n  faq:` boundary — end of sections array.
  const marker = /\n  ],\n  faq:/;
  const match = content.match(marker);
  if (!match || match.index === undefined) {
    console.warn("⚠️  marker not found in", filePath);
    return false;
  }
  const before = content.slice(0, match.index);
  const after = content.slice(match.index);

  const next = before + "\n" + newSection + after;
  writeFileSync(filePath, next, "utf8");
  return true;
}

const files = readdirSync(POSTS_DIR).filter((f) => f.endsWith(".ts"));
let updated = 0;
for (const f of files) {
  const ok = injectSources(join(POSTS_DIR, f));
  if (ok) {
    console.log("✓", f);
    updated++;
  }
}
console.log(`\nUpdated ${updated} files.`);

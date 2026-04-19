import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { CATEGORIES, getCategoryById } from "@/lib/categories";
import { slugToCity, type FrenchCity } from "@/lib/cities";

export type SeoFaqItem = { q: string; a: string };

export type SeoContent = {
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  localTips: string | null;
  faq: SeoFaqItem[];
  keywords: string[];
};

export type SeoPageTarget = {
  categoryId: string;
  subcategorySlug?: string;
  citySlug?: string;
};

export function subcategoryToSlug(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function slugToSubcategoryLabel(categoryId: string, slug: string): string | null {
  const cat = getCategoryById(categoryId);
  if (!cat) return null;
  const match = cat.subcategories.find((s) => subcategoryToSlug(s) === slug);
  return match ?? null;
}

export function pageKey(target: SeoPageTarget): string {
  return [target.categoryId, target.subcategorySlug ?? "_", target.citySlug ?? "_"].join(":");
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt(target: SeoPageTarget, city: FrenchCity | null, subLabel: string | null): string {
  const cat = getCategoryById(target.categoryId);
  if (!cat) throw new Error(`Unknown category ${target.categoryId}`);

  const scope = [
    `Catégorie: ${cat.label}`,
    subLabel ? `Sous-catégorie: ${subLabel}` : null,
    city ? `Ville: ${city.name} (${city.department}, ${city.region}, ~${city.population.toLocaleString("fr-FR")} habitants)` : `Zone: France entière`,
  ].filter(Boolean).join("\n");

  return `Tu es un rédacteur SEO expert pour un site de petites annonces français (Deal&Co, dealandcompany.fr), concurrent direct de Leboncoin.

Génère le contenu SEO pour cette page :
${scope}

Contraintes strictes :
- Français naturel, pas de formules creuses, pas de langue de bois.
- Pas de promesses factuelles vérifiables (prix, statistiques chiffrées, classements) que tu ne peux pas sourcer.
- Contenu 100% unique, adapté à la combinaison exacte ci-dessus.
- Ton neutre et informatif, avec quelques éléments de contexte local quand une ville est indiquée.
- Aucune mention de concurrents par nom.
- Intègre naturellement la catégorie${subLabel ? ", la sous-catégorie" : ""}${city ? " et le nom de la ville" : ""} dans le contenu.
- Pas de markdown, pas d'emojis, pas de listes avec tirets.

Produis UNIQUEMENT un objet JSON valide (aucun texte avant/après), avec ces clés :
{
  "metaTitle": "60 caractères max, percutant, inclut la catégorie${city ? " et la ville" : ""}",
  "metaDescription": "155 caractères max, accrocheur, inclut un call-to-action",
  "h1": "titre principal de la page, différent du metaTitle",
  "intro": "paragraphe d'introduction de 80 à 130 mots, unique et informatif",
  "localTips": ${city ? `"paragraphe de 60 à 100 mots avec des conseils pratiques pour acheter/vendre des ${subLabel ?? cat.label} à ${city.name} (quartiers, points de rencontre habituels, spécificités locales pertinentes)"` : `null`},
  "faq": [
    {"q": "question 1", "a": "réponse 2-3 phrases"},
    {"q": "question 2", "a": "réponse 2-3 phrases"},
    {"q": "question 3", "a": "réponse 2-3 phrases"},
    {"q": "question 4", "a": "réponse 2-3 phrases"}
  ],
  "keywords": ["5 à 8 mots-clés longue traîne pertinents"]
}`;
}

function parseJsonFromResponse(text: string): SeoContent {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const parsed = JSON.parse(cleaned);

  if (!parsed.metaTitle || !parsed.metaDescription || !parsed.h1 || !parsed.intro) {
    throw new Error("Réponse IA incomplète");
  }

  return {
    metaTitle: String(parsed.metaTitle).slice(0, 70),
    metaDescription: String(parsed.metaDescription).slice(0, 170),
    h1: String(parsed.h1),
    intro: String(parsed.intro),
    localTips: parsed.localTips ? String(parsed.localTips) : null,
    faq: Array.isArray(parsed.faq)
      ? parsed.faq.filter((f: any) => f?.q && f?.a).map((f: any) => ({ q: String(f.q), a: String(f.a) }))
      : [],
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map((k: any) => String(k)) : [],
  };
}

export async function generateSeoContent(target: SeoPageTarget): Promise<SeoContent> {
  const cat = getCategoryById(target.categoryId);
  if (!cat) throw new Error(`Unknown category ${target.categoryId}`);

  const city = target.citySlug ? slugToCity(target.citySlug) ?? null : null;
  const subLabel = target.subcategorySlug ? slugToSubcategoryLabel(target.categoryId, target.subcategorySlug) : null;

  const prompt = buildPrompt(target, city, subLabel);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("Réponse IA vide");

  return parseJsonFromResponse(block.text);
}

export async function getOrCreateSeoContent(target: SeoPageTarget): Promise<SeoContent | null> {
  const key = pageKey(target);
  const existing = await prisma.seoPageContent.findUnique({ where: { pageKey: key } }).catch(() => null);

  if (existing) {
    return {
      metaTitle: existing.metaTitle,
      metaDescription: existing.metaDescription,
      h1: existing.h1,
      intro: existing.intro,
      localTips: existing.localTips,
      faq: JSON.parse(existing.faq) as SeoFaqItem[],
      keywords: JSON.parse(existing.keywords) as string[],
    };
  }

  if (process.env.SEO_AI_ENABLED !== "true") {
    return null;
  }

  try {
    const content = await generateSeoContent(target);
    await prisma.seoPageContent.create({
      data: {
        pageKey: key,
        categoryId: target.categoryId,
        subcategorySlug: target.subcategorySlug ?? null,
        citySlug: target.citySlug ?? null,
        metaTitle: content.metaTitle,
        metaDescription: content.metaDescription,
        h1: content.h1,
        intro: content.intro,
        localTips: content.localTips,
        faq: JSON.stringify(content.faq),
        keywords: JSON.stringify(content.keywords),
        model: "claude-haiku-4-5",
      },
    });
    return content;
  } catch (err) {
    console.error("[seo-content] génération échouée", key, err);
    return null;
  }
}

function populationTier(p: number): "metropole" | "grande-ville" | "ville-moyenne" | "petite-ville" {
  if (p >= 300000) return "metropole";
  if (p >= 100000) return "grande-ville";
  if (p >= 30000) return "ville-moyenne";
  return "petite-ville";
}

function introByCategory(categoryId: string, cityName: string, region: string, tier: string): string {
  const base: Record<string, string> = {
    immobilier: `Trouvez votre futur logement à ${cityName} parmi les annonces immobilières publiées par des particuliers et des professionnels. Que vous cherchiez à acheter une maison, louer un appartement, trouver une colocation ou investir dans un bien commercial, notre sélection couvre tous les quartiers de ${cityName} et ses environs en ${region}. Les annonces sont mises à jour en continu pour vous donner accès aux dernières opportunités du marché local.`,
    vehicules: `Achetez ou vendez un véhicule à ${cityName} directement entre particuliers. Notre plateforme regroupe voitures d'occasion, motos, utilitaires, caravanes et équipements auto proposés à ${cityName} et dans toute la région ${region}. Chaque annonce inclut photos, kilométrage et année du véhicule, pour vous permettre de comparer facilement avant de prendre rendez-vous avec le vendeur sur place.`,
    maison: `Aménagez votre intérieur à petit prix grâce aux annonces maison et jardin publiées à ${cityName}. Meubles, électroménager, décoration, outils de bricolage et matériel de jardinage trouvent ici une seconde vie auprès de particuliers proches de chez vous. Idéal pour équiper votre logement sans exploser votre budget tout en favorisant le réemploi local.`,
    multimedia: `Découvrez les annonces multimédia à ${cityName} : smartphones, ordinateurs, consoles de jeux, téléviseurs et accessoires proposés par des particuliers de la région. Achetez neuf ou d'occasion sans frais de port en choisissant un vendeur local, et profitez de prix souvent très inférieurs aux magasins grâce à la vente directe entre particuliers.`,
    mode: `Renouvelez votre garde-robe grâce aux annonces mode disponibles à ${cityName}. Vêtements, chaussures, sacs, montres et bijoux de seconde main sont proposés par des particuliers près de chez vous. Un choix économique et responsable pour dénicher des pièces tendances ou des marques à prix réduits sans attendre de livraison.`,
    loisirs: `Explorez toutes les annonces loisirs publiées à ${cityName} : livres, DVD, instruments de musique, jeux vidéo, vélos, matériel de sport et passions variées. Que vous cherchiez un équipement d'occasion ou que vous souhaitiez vendre ce que vous n'utilisez plus, vous trouverez ici une communauté active d'acheteurs et de vendeurs locaux.`,
    animaux: `Consultez les annonces consacrées aux animaux à ${cityName} et dans la région ${region}. Chiens, chats, NAC, accessoires pour animaux de compagnie : retrouvez des annonces publiées par des particuliers et éleveurs près de chez vous. Rencontrez le vendeur sur place avant toute transaction pour valider que l'animal correspond à vos attentes.`,
    services: `Trouvez ou proposez un service à ${cityName} : cours particuliers, bricolage, aide à domicile, événementiel, déménagement et nombreuses autres prestations sont référencées par des indépendants et particuliers du secteur. Un moyen rapide et direct de faire appel à quelqu'un de local sans intermédiaire.`,
    emploi: `Consultez les offres d'emploi publiées à ${cityName} par des employeurs locaux et professionnels de la région ${region}. CDI, CDD, intérim ou temps partiel : parcourez librement les annonces correspondant à votre profil et postulez directement auprès du recruteur depuis la fiche de l'annonce.`,
    communaute: `Rejoignez la communauté locale à ${cityName} : événements, associations, rencontres et entraide sont autant de manières de tisser des liens dans votre ville. Les annonces sont publiées par des habitants et organisateurs de la région ${region} qui cherchent à partager leurs initiatives ou à créer du lien.`,
    "materiel-pro": `Accédez aux annonces de matériel professionnel disponibles à ${cityName} : BTP, restauration, agriculture, industrie. Cette section regroupe des équipements d'occasion ou neufs proposés par des entreprises et professionnels indépendants de la région, avec possibilité d'inspection sur place avant achat.`,
    "bebe-enfant": `Équipez vos enfants à petit prix grâce aux annonces bébé et enfant publiées à ${cityName}. Puériculture, vêtements, jouets et mobilier d'occasion sont proposés par d'autres parents de la région qui cherchent à donner une seconde vie à ce que leurs enfants n'utilisent plus. Pratique, économique et écologique.`,
    vacances: `Préparez vos prochaines vacances grâce aux annonces disponibles à ${cityName} : locations saisonnières, échanges de maisons, camping, séjours et circuits. Les offres sont publiées par des particuliers et loueurs locaux, souvent à des tarifs plus attractifs que les plateformes traditionnelles.`,
    divers: `Parcourez les annonces diverses publiées à ${cityName} : tout ce qui n'entre pas dans les catégories principales se trouve ici. Objets uniques, pièces rares, lots variés… c'est l'endroit où faire de bonnes trouvailles inattendues auprès de vendeurs de la région ${region}.`,
  };
  return base[categoryId] ?? `Retrouvez toutes les annonces ${categoryId} publiées à ${cityName} sur Deal&Co. Achat, vente et échange entre particuliers dans toute la région ${region}.`;
}

function localTipsFor(cityName: string, region: string, dept: string, categoryLabel: string, tier: string): string {
  const meetingTips: Record<string, string> = {
    metropole: `Privilégiez les rendez-vous dans des lieux publics et passants de ${cityName} : parvis de gares, galeries commerciales ou cafés fréquentés. Les transactions en main propre évitent les frais d'envoi et permettent de vérifier l'état du bien avant paiement.`,
    "grande-ville": `À ${cityName}, les rendez-vous se déroulent souvent en centre-ville ou près des grands axes. Convenir d'un horaire en journée dans un endroit passant reste la meilleure façon de sécuriser la transaction.`,
    "ville-moyenne": `Dans une ville comme ${cityName}, les places principales, parkings de supermarchés et zones commerciales sont des points de rendez-vous habituels pour finaliser une vente entre particuliers.`,
    "petite-ville": `À ${cityName}, les transactions se font souvent au domicile du vendeur ou sur un parking passant du centre. Privilégiez les horaires de journée pour inspecter sereinement l'article.`,
  };
  return `Pour acheter ou vendre ${categoryLabel.toLowerCase()} à ${cityName} (${dept}, ${region}), quelques repères pratiques. ${meetingTips[tier]} Vérifiez toujours l'identité de votre interlocuteur, demandez à voir l'objet ou visiter le bien avant tout paiement, et privilégiez les règlements sécurisés. En cas de doute sur une annonce, signalez-la pour qu'elle soit examinée par notre équipe de modération.`;
}

function faqFor(categoryId: string, cityName: string | null, subLabel: string | null, categoryLabel: string): SeoFaqItem[] {
  const segment = subLabel ?? categoryLabel;
  const where = cityName ? ` à ${cityName}` : " en France";

  const common: SeoFaqItem[] = [
    {
      q: `Comment publier une annonce ${segment.toLowerCase()}${where} ?`,
      a: `Créez un compte gratuit sur Deal&Co, cliquez sur "Publier une annonce", sélectionnez la catégorie ${categoryLabel.toLowerCase()}, ajoutez vos photos et une description détaillée. Votre annonce est généralement visible en quelques minutes après modération.`,
    },
    {
      q: `La publication d'annonces est-elle payante ?`,
      a: `Non, la publication d'annonces entre particuliers est entièrement gratuite sur Deal&Co. Des options de mise en avant payantes existent pour donner plus de visibilité à votre annonce si vous le souhaitez.`,
    },
    {
      q: `Comment contacter le vendeur d'une annonce ${segment.toLowerCase()}${where} ?`,
      a: `Depuis la fiche de l'annonce, cliquez sur "Contacter" pour envoyer un message via la messagerie interne. Si le vendeur a rendu son numéro visible, vous pouvez aussi l'appeler directement. Échangez toujours avant de vous rencontrer.`,
    },
    {
      q: `Comment éviter les arnaques lors d'une transaction ?`,
      a: `Méfiez-vous des prix anormalement bas, des demandes de paiement anticipé par virement ou mandat cash, et des vendeurs qui refusent une rencontre en personne. Inspectez toujours l'objet avant de payer et privilégiez les rendez-vous dans un lieu public.`,
    },
  ];

  const perCategory: Record<string, SeoFaqItem[]> = {
    immobilier: [
      {
        q: `Quels documents demander lors d'une visite immobilière${where} ?`,
        a: `Pour un achat, demandez le titre de propriété, les diagnostics techniques (DPE, amiante, plomb), les charges de copropriété et les derniers avis de taxe foncière. Pour une location, exigez une quittance de loyer type et les relevés des dernières charges.`,
      },
      {
        q: `Quelles sont les pièces à fournir pour louer un logement${where} ?`,
        a: `Les bailleurs demandent généralement une pièce d'identité, les trois derniers bulletins de salaire, le dernier avis d'imposition, une attestation employeur et un justificatif de domicile. Un garant peut être exigé selon votre situation.`,
      },
    ],
    vehicules: [
      {
        q: `Quels documents vérifier lors de l'achat d'un véhicule d'occasion ?`,
        a: `Exigez la carte grise au nom du vendeur, un certificat de non-gage récent de moins de 15 jours, le procès-verbal de contrôle technique de moins de 6 mois pour une voiture de plus de 4 ans, et le carnet d'entretien si disponible.`,
      },
      {
        q: `Comment se déroule le transfert de carte grise après achat ?`,
        a: `Le vendeur remplit un certificat de cession (Cerfa 15776) et vous remet la carte grise barrée. Vous disposez de 30 jours pour faire la nouvelle carte grise à votre nom sur le site de l'ANTS (ants.gouv.fr).`,
      },
    ],
    multimedia: [
      {
        q: `Comment vérifier l'état d'un smartphone ou d'un ordinateur d'occasion ?`,
        a: `Demandez à allumer l'appareil devant vous, vérifiez l'autonomie de la batterie, testez les ports, l'écran et les haut-parleurs. Pour un smartphone, contrôlez qu'il n'est pas bloqué iCloud ou compte Google, et que l'IMEI n'est pas en liste noire.`,
      },
    ],
    immobilier_fallback: [],
  };

  const specific = perCategory[categoryId] ?? [];
  return [...specific, ...common].slice(0, 4);
}

export function fallbackContent(target: SeoPageTarget): SeoContent {
  const cat = getCategoryById(target.categoryId);
  const city = target.citySlug ? slugToCity(target.citySlug) : null;
  const subLabel = target.subcategorySlug ? slugToSubcategoryLabel(target.categoryId, target.subcategorySlug) : null;

  const catLabel = cat?.label ?? target.categoryId;
  const segment = subLabel ?? catLabel;
  const cityName = city?.name ?? null;
  const region = city?.region ?? "France";
  const dept = city?.department ?? "";
  const tier = city ? populationTier(city.population) : "grande-ville";

  const where = cityName ? ` à ${cityName}` : " en France";
  const whereLower = cityName ? ` à ${cityName}` : " partout en France";

  const metaTitle = subLabel
    ? `${subLabel}${where} — Annonces ${catLabel} | Deal&Co`
    : `Annonces ${catLabel}${where} | Deal&Co`;

  const metaDescription = subLabel
    ? `Annonces ${subLabel.toLowerCase()}${whereLower} sur Deal&Co. Achetez et vendez entre particuliers en toute simplicité, photos, prix et contact direct du vendeur.`
    : `Toutes les annonces ${catLabel.toLowerCase()}${whereLower} sur Deal&Co. Petites annonces gratuites entre particuliers, photos, prix et contact direct.`;

  const h1 = subLabel
    ? `Annonces ${subLabel}${where}`
    : `Annonces ${catLabel}${where}`;

  const intro = cityName
    ? (subLabel
        ? `Parcourez les annonces ${subLabel.toLowerCase()} publiées à ${cityName} et dans la région ${region}. Les annonces sont publiées par des particuliers et professionnels locaux, avec photos, prix et contact direct du vendeur. Un moyen efficace de trouver ou vendre ${subLabel.toLowerCase()} près de chez vous, sans frais d'envoi et avec possibilité d'inspection sur place.`
        : introByCategory(target.categoryId, cityName, region, tier))
    : `Retrouvez toutes les annonces ${segment.toLowerCase()} publiées en France sur Deal&Co. Achat, vente et échange entre particuliers dans toutes les régions, avec photos, prix et contact direct avec le vendeur. Filtrez par ville pour trouver les annonces près de chez vous.`;

  const localTips = cityName ? localTipsFor(cityName, region, dept, subLabel ?? catLabel, tier) : null;

  const faq = faqFor(target.categoryId, cityName, subLabel, catLabel);

  const keywords = [
    segment.toLowerCase(),
    `${segment.toLowerCase()} occasion`,
    cityName ? segment.toLowerCase() + " " + cityName.toLowerCase() : "petites annonces",
    cityName ? `annonces ${cityName.toLowerCase()}` : "annonces france",
    cityName ? `vendre ${catLabel.toLowerCase()} ${cityName.toLowerCase()}` : `vendre ${catLabel.toLowerCase()}`,
    catLabel.toLowerCase() + " entre particuliers",
  ];

  return {
    metaTitle: metaTitle.slice(0, 70),
    metaDescription: metaDescription.slice(0, 170),
    h1,
    intro,
    localTips,
    faq,
    keywords,
  };
}

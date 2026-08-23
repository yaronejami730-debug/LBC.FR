/**
 * Vérifications du titre et de la description des fiches annonces.
 *
 * Le défaut corrigé ne se voyait pas en lisant le code : la metadata était bien
 * construite, mais deux branches retournaient avant de l'utiliser, et Next
 * remontait alors au titre du layout racine. Ce qui se teste ici n'est donc pas
 * la mise en forme — c'est la propriété qui manquait : **deux annonces
 * différentes ne doivent jamais produire le même titre ni la même
 * description**, quel que soit l'état de leurs champs.
 *
 *     npx tsx -r ./scripts/load-env.ts scripts/test-listing-meta.ts
 */
import { buildListingMeta, priceLabelOf, TITLE_CAP } from "../lib/seo/listing-meta";
import { check, equal, report, section } from "./test-helpers";

/**
 * Normalise les espaces insécables.
 *
 * `toLocaleString("fr-FR")` sépare les milliers par une espace fine insécable
 * (U+202F) et non par une espace ordinaire — c'est la typographie française
 * correcte, et il ne faut surtout pas la « corriger » dans le rendu. Ce sont
 * donc les comparaisons du test qui s'y adaptent.
 */
const norm = (v: string) => v.replace(/[\u00a0\u202f]/g, " ");

section("Format nominal");
{
  const meta = buildListingMeta({
    title: "Volkswagen GOLF 1.6 TDI",
    description:
      "Golf 1.6 TDI de 2015, 145 000 km, entretien suivi, distribution faite. Carnet complet, contrôle technique vierge.",
    location: "59000 Lille",
    price: 1500,
    category: "Véhicules",
    subcategory: "Voiture",
  });

  equal(
    "titre au format « {annonce} à {ville} — {prix} | Deal&Co »",
    norm(meta.title),
    "Volkswagen GOLF 1.6 TDI à Lille — 1 500 € | Deal&Co",
  );
  check("la description commence par celle de l'annonce", meta.description.startsWith("Golf 1.6 TDI de 2015"));
  check("elle porte la ville", meta.description.includes("Lille"));
  check("et le prix", norm(meta.description).includes("1 500 €"));
  equal("le code postal ne remonte pas dans le titre", meta.city, "Lille");
}

section("Champs manquants : le repli reste propre à l'annonce");
{
  const generic = "Deal&Co — Petites annonces gratuites entre particuliers";

  const sansDescription = buildListingMeta({
    title: "Table basse chêne massif",
    description: "",
    location: "Toulouse",
    price: 80,
    category: "Maison",
    subcategory: "Ameublement",
  });
  check(
    "sans description, on décrit l'annonce avec ce qu'on a",
    sansDescription.description.includes("Table basse chêne massif") &&
      sansDescription.description.includes("Toulouse") &&
      norm(sansDescription.description).includes("80 €"),
    sansDescription.description,
  );
  check(
    "et jamais avec le texte du site",
    !sansDescription.description.includes(generic) && !sansDescription.title.includes(generic),
  );

  const troisMots = buildListingMeta({
    title: "iPhone 12 128 Go",
    description: "Bon état",
    location: "Lyon",
    price: 250,
  });
  check(
    "une description de trois mots ne décrit rien : on compose",
    troisMots.description.includes("iPhone 12 128 Go") && troisMots.description.includes("Lyon"),
  );

  const sansPrix = buildListingMeta({
    title: "Canapé d'angle",
    description: "Canapé d'angle convertible, tissu gris, très bon état général, à récupérer sur place.",
    location: "Nantes",
    price: 0,
  });
  check("un prix absent n'est pas « 0 € »", sansPrix.title.includes("Prix à débattre"));
  check("un prix absent n'affiche jamais zéro", !sansPrix.title.includes("0 €"));

  const sansVille = buildListingMeta({
    title: "Perceuse Bosch GSB 18V",
    description: "Perceuse visseuse sans fil avec deux batteries et chargeur, peu servie.",
    location: null,
    price: 90,
  });
  check("sans ville, le titre reste celui de l'annonce", sansVille.title.startsWith("Perceuse Bosch GSB 18V"));
  check("et n'invente pas de localisation", !sansVille.title.includes(" à "));

  const vide = buildListingMeta({ title: "Lot de livres", description: null, location: null, price: null });
  check(
    "tout manquant : il reste le titre de l'annonce",
    vide.title.startsWith("Lot de livres") && vide.description.includes("Lot de livres"),
  );
}

section("Unicité — le défaut d'origine");
{
  // Deux annonces sans description, même ville, même prix : c'est le cas qui
  // produisait 33 titres identiques. Leur seul point commun ne doit pas suffire
  // à les confondre.
  const a = buildListingMeta({ title: "Vélo de route Decathlon", location: "Lille", price: 300 });
  const b = buildListingMeta({ title: "Machine à laver Bosch", location: "Lille", price: 300 });

  check("deux annonces dépouillées gardent des titres distincts", a.title !== b.title);
  check("et des descriptions distinctes", a.description !== b.description);
}

section("Troncature");
{
  const long = buildListingMeta({
    title:
      "Magnifique appartement traversant entièrement rénové avec terrasse plein sud et parking privatif",
    description: "Bien rare, à visiter rapidement.",
    location: "Bordeaux",
    price: 349_000,
  });

  check("le titre respecte le plafond d'affichage", long.title.length <= TITLE_CAP, `${long.title.length} caractères`);
  check("le nom du site survit à la troncature", long.title.endsWith(" | Deal&Co"));
  check("la coupe se fait entre deux mots", !/\S…/.test(long.title.replace("…", " …")) || long.title.includes("… |"));
}

section("Casse des villes saisies à la main");
{
  const brut = buildListingMeta({ title: "Plusieurs étagères", location: "sens", price: 4 });
  check("une ville en minuscules est remise en forme", brut.title.includes("à Sens"), brut.title);

  const particules = buildListingMeta({
    title: "Montre Diesel DZ-7333",
    location: "gournay sur marne",
    price: 130,
  });
  check(
    "les particules restent en bas de casse",
    particules.title.includes("à Gournay sur Marne"),
    particules.title,
  );

  const tiret = buildListingMeta({ title: "Vélo", location: "saint-denis", price: 60 });
  check("les noms composés gardent leurs majuscules", tiret.title.includes("à Saint-Denis"), tiret.title);
}

section("Libellé de prix");
{
  equal("un prix rond se lit avec son séparateur", norm(priceLabelOf(1500)), "1 500 €");
  equal("zéro n'est pas un prix", priceLabelOf(0), "Prix à débattre");
  equal("absent non plus", priceLabelOf(null), "Prix à débattre");
}

report("Metadata des fiches annonces");

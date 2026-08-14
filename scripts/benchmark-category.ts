/**
 * Banc d'essai de la catégorisation.
 *
 *   npm run category:bench
 *
 * Les titres sont écrits comme les vendeurs écrivent — fautes comprises. Un
 * moteur mesuré uniquement sur des titres propres se croit meilleur qu'il ne
 * l'est.
 */
import { classifyTitle } from "../lib/category/engine";

/** [titre, catégorie attendue, sous-catégorie attendue ou null si indifférent] */
const CASES: [string, string, string | null][] = [
  // Évidents
  ["iPhone 15 Pro Max 256 Go", "multimedia", "telephonie"],
  ["Peugeot 208 GT Line 2022", "vehicules", "voitures"],
  ["PS5 avec 2 manettes", "multimedia", "consoles-et-jeux-video"],
  ["Canapé 3 places cuir", "maison", "ameublement"],
  ["Appartement 2 pièces Paris 11e", "immobilier", null],
  ["VTT électrique Decathlon", "loisirs", "velos"],
  ["MacBook Pro 14 pouces M3", "multimedia", "informatique"],
  ["Robe Zara taille 38", "mode", "vetements"],
  ["Chaussures Nike homme 42", "mode", "chaussures"],
  ["Montre Rolex Submariner", "mode", "montres-et-bijoux"],
  ["Télévision Samsung 55 pouces", "multimedia", "image-et-son"],
  ["Perceuse Bosch sans fil", "maison", "bricolage"],
  ["Tondeuse à gazon thermique", "maison", "jardinage"],
  ["Réfrigérateur combiné Bosch", "maison", "electromenager"],
  ["Guitare électrique Fender", "loisirs", "musique-instruments"],
  ["Chaton siamois à donner", "animaux", "animaux"],
  ["Aquarium 200 litres", "animaux", "accessoires-pour-animaux"],
  ["BMW Série 3 320d automatique", "vehicules", "voitures"],
  ["Yamaha MT07 35kW", "vehicules", "motos"],
  ["Camping-car Chausson profilé", "vehicules", "caravaning"],
  ["Renault Master fourgon", "vehicules", "utilitaires"],
  ["Pneus hiver Michelin 205 55 16", "vehicules", "equipements-auto"],
  // Bascules contextuelles — le cœur du problème
  ["Lit bébé évolutif blanc", "bebe-enfant", "mobilier-enfant"],
  ["Lit 2 places avec matelas", "maison", "ameublement"],
  ["Table de massage pliante", "beaute-bien-etre", "massage"],
  ["Table à manger en chêne", "maison", "ameublement"],
  ["Siège auto bébé isofix", "bebe-enfant", "puericulture"],
  ["Siège de bureau ergonomique", "maison", null],
  ["Poussette Yoyo Babyzen", "bebe-enfant", "puericulture"],
  ["Vêtements bébé 6 mois lot", "bebe-enfant", "vetements-enfant"],
  // Services et bien-être
  ["Massage relaxant à domicile", "beaute-bien-etre", "massage"],
  ["Manucure semi-permanente", "beaute-bien-etre", "onglerie"],
  ["Extension de cils volume russe", "beaute-bien-etre", "sourcils-et-cils"],
  ["Coiffeuse à domicile Marseille", "beaute-bien-etre", "coiffure"],
  ["Épilation laser jambes", "beaute-bien-etre", "epilation"],
  ["Location cabine esthétique", "beaute-bien-etre", "location-d-espace-bien-etre"],
  ["Cours de guitare débutant", "services", "cours-particuliers"],
  ["Plombier dépannage urgence", "services", "reparations"],
  ["DJ mariage sonorisation", "services", "evenementiel"],
  ["Ménage repassage à domicile", "services", "services-a-la-personne"],
  ["Recrute serveur CDI temps plein", "emploi", "offres-d-emploi"],
  // Autres catégories longtemps inaccessibles
  ["Places concert Stade de France", "communaute", "evenements"],
  ["Association recherche bénévoles", "communaute", "associations"],
  ["Mini-pelle Kubota 2 tonnes", "materiel-pro", "btp-chantier"],
  ["Chambre froide restaurant inox", "materiel-pro", "restauration"],
  ["Tracteur John Deere", "materiel-pro", "agriculture"],
  ["Gîte 6 personnes piscine semaine", "vacances", null],
  // Fautes de frappe
  ["Peugot 208 essence", "vehicules", "voitures"],
  ["Iphne 15 très bon état", "multimedia", "telephonie"],
  ["canappe cuir marron", "maison", "ameublement"],
  ["massage sporrtif", "beaute-bien-etre", "massage"],
  ["pousette bebe", "bebe-enfant", "puericulture"],
  // Formulations naturelles
  ["Je vends ma Clio 4 essence", "vehicules", "voitures"],
  ["URGENT !!! magnifique Peugeot 208 à vendre", "vehicules", "voitures"],
  ["208 essence 2022 première main", "vehicules", "voitures"],
  ["Vends canapé angle convertible cause déménagement", "maison", "ameublement"],
];

/** Titres qui ne doivent surtout pas produire une catégorie sûre. */
const AMBIGUOUS = ["Apple", "Pro", "Pack", "Classic", "Neuf", "Urgent", "Lot divers", "Bonne affaire"];

function run() {
  const rows = [
    { name: "MOTEUR DE CATÉGORISATION", fn: (t: string) => {
        const r = classifyTitle(t);
        return r.categoryId ? { cat: r.categoryId, sub: r.subcategoryId, conf: r.confidence, status: r.status } : null;
      } },
  ];

  for (const engine of rows) {
    let justes = 0, sousJustes = 0, sousTestees = 0, faux = 0, muets = 0;
    const erreurs: string[] = [];
    const t0 = performance.now();
    for (const [title, cat, sub] of CASES) {
      const r = engine.fn(title);
      if (!r) { muets++; erreurs.push(`∅ ${title}`); continue; }
      if (r.cat === cat) {
        justes++;
        if (sub) { sousTestees++; if (r.sub === sub) sousJustes++; else erreurs.push(`~ ${title} → sous-cat ${r.sub ?? "—"} (attendu ${sub})`); }
      } else { faux++; erreurs.push(`✗ ${title} → ${r.cat} (attendu ${cat})`); }
    }
    const ms = performance.now() - t0;

    let ambigusOk = 0;
    for (const title of AMBIGUOUS) {
      const r = engine.fn(title);
      if (!r || r.status === "ambiguous") ambigusOk++;
    }

    const n = CASES.length;
    console.log(`\n${engine.name}`);
    console.log(`  catégorie juste     ${justes}/${n}  (${Math.round((justes / n) * 100)} %)`);
    console.log(`  sous-catégorie      ${sousJustes}/${sousTestees}`);
    console.log(`  mauvaise catégorie  ${faux}`);
    console.log(`  sans réponse        ${muets}`);
    console.log(`  ambigus bien gérés  ${ambigusOk}/${AMBIGUOUS.length}`);
    console.log(`  temps               ${ms.toFixed(1)} ms pour ${n} titres (${(ms / n).toFixed(2)} ms/titre)`);
    if (erreurs.length) {
      console.log("  écarts :");
      erreurs.slice(0, 10).forEach((e) => console.log("    " + e));
    }
  }
}

run();

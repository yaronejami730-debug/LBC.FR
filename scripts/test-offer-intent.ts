/**
 * Banc d'essai du moteur d'intention (`lib/offer-intent.ts`).
 *
 *   npm run test:intent
 *
 * Les cas sont écrits comme les annonceurs écrivent : accents, abréviations,
 * majuscules aléatoires, prix collé au texte. Un moteur qui ne passe que sur
 * du français propre ne sert à rien ici.
 *
 * Chaque cas vérifie la nature, et surtout si l'état de l'objet est demandé —
 * c'est le symptôme d'origine : « État du produit » proposé pour une manucure.
 */

import { inferOfferIntent, type OfferNature } from "../lib/offer-intent";
import { fieldSetAsksCondition } from "../lib/offer-fields";

type Case = {
  title: string;
  description?: string;
  categoryId?: string;
  subcategory?: string;
  price?: number;
  nature: OfferNature;
  /** État attendu du champ « état de l'objet ». */
  condition: boolean;
  /** Confiance minimale attendue. */
  minConfidence?: number;
};

const CASES: Case[] = [
  // ── Le bug d'origine ────────────────────────────────────────
  { title: "Manucure pédicure à domicile 35€", nature: "prestation", condition: false, minConfidence: 0.6 },
  { title: "Manucure semi permanent", categoryId: "beaute-bien-etre", nature: "prestation", condition: false },
  { title: "manucure", categoryId: "divers", nature: "prestation", condition: false },
  { title: "Pose d'ongles en gel", nature: "prestation", condition: false },

  // ── Pièges lexicaux : le même champ lexical vend un objet ────
  { title: "Vernis semi permanent neuf lot de 12", nature: "bien", condition: true },
  { title: "Table de massage pliante TBE", nature: "bien", condition: true },
  { title: "Lampe UV ongles, jamais servi, envoi possible", nature: "bien", condition: true },

  // ── Prestations hors bien-être ──────────────────────────────
  { title: "Cours de guitare 20€/h", nature: "prestation", condition: false },
  { title: "Dépannage plomberie 7j/7, devis gratuit", nature: "prestation", condition: false },
  { title: "Photographe mariage, sur devis", nature: "prestation", condition: false },
  { title: "Ménage et repassage, je me déplace", nature: "prestation", condition: false },

  // ── Biens ordinaires : aucune régression tolérée ────────────
  { title: "Canapé cuir 3 places très bon état", categoryId: "maison", nature: "bien", condition: true },
  { title: "iPhone 14 128 Go, boîte d'origine", categoryId: "multimedia", nature: "bien", condition: true },
  { title: "Peugeot 208 2019 essence, CT ok", categoryId: "vehicules", nature: "bien", condition: true },
  { title: "Blouson cuir taille M", categoryId: "mode", nature: "bien", condition: true },

  // ── Demandes ────────────────────────────────────────────────
  { title: "Cherche prothésiste ongulaire", nature: "demande", condition: false },
  { title: "Recherche appartement T2 Marseille", nature: "demande", condition: false },
  { title: "Achète vos vieilles montres", nature: "demande", condition: false },

  // ── Locations ───────────────────────────────────────────────
  { title: "Loue table de manucure au mois", nature: "location", condition: true },
  { title: "Gîte 6 personnes à louer, 120€ par nuit", nature: "location", condition: true },
  { title: "Location de remorque, caution 200€", nature: "location", condition: true },

  // ── Emploi ──────────────────────────────────────────────────
  { title: "Recrute esthéticienne CDI temps plein H/F", nature: "emploi", condition: false },
  { title: "Offre d'emploi : serveur CDD", categoryId: "emploi", nature: "emploi", condition: false },

  // ── Immobilier ──────────────────────────────────────────────
  { title: "Appartement T3 75 m² avec balcon", categoryId: "immobilier", nature: "immobilier", condition: false },
  {
    title: "Studio meublé, charges comprises",
    categoryId: "immobilier",
    subcategory: "Locations",
    nature: "immobilier",
    condition: false,
  },

  // ── Don ─────────────────────────────────────────────────────
  { title: "Canapé à donner", price: 0, nature: "don", condition: true },

  // ── Événement ───────────────────────────────────────────────
  { title: "Vide grenier dimanche matin", categoryId: "communaute", nature: "evenement", condition: false },
];

let failed = 0;

for (const c of CASES) {
  const intent = inferOfferIntent({
    title: c.title,
    description: c.description,
    categoryId: c.categoryId ?? null,
    subcategory: c.subcategory ?? null,
    price: c.price ?? null,
  });

  const asksCondition = fieldSetAsksCondition(intent.fieldSet);
  const errors: string[] = [];

  if (intent.nature !== c.nature) errors.push(`nature = ${intent.nature}, attendu ${c.nature}`);
  if (asksCondition !== c.condition)
    errors.push(`état demandé = ${asksCondition}, attendu ${c.condition}`);
  if (c.minConfidence != null && intent.confidence < c.minConfidence)
    errors.push(`confiance ${intent.confidence} < ${c.minConfidence}`);

  if (errors.length > 0) {
    failed++;
    console.log(`\x1b[31m✗\x1b[0m ${c.title}`);
    for (const e of errors) console.log(`    ${e}`);
    console.log(`    signaux : ${intent.signals.join(" · ") || "aucun"}`);
  } else {
    console.log(
      `\x1b[32m✓\x1b[0m ${c.title.padEnd(48)} ${intent.nature.padEnd(11)} ${intent.fieldSet.padEnd(21)} ${intent.confidence}`,
    );
  }
}

console.log(`\n${CASES.length - failed}/${CASES.length} cas passent.`);
process.exit(failed > 0 ? 1 : 0);

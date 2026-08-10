import { NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/categories";
import {
  WELLNESS_CATEGORY_ID,
  WELLNESS_MAX_FOR_INDIVIDUALS,
  WELLNESS_PRO_THRESHOLD,
} from "@/lib/moderation/wellness-policy";
import {
  WELLNESS_DURATIONS,
  WELLNESS_PRICE_UNITS,
  WELLNESS_TARIFF_TYPES,
  WELLNESS_PLACES,
  WELLNESS_ONE_PER_LISTING_NOTICE,
  WELLNESS_MAX_SERVICES,
} from "@/lib/wellness/publish-fields";
import { FIELD_SETS } from "@/lib/offer-fields";
import { OFFER_INTENT_VERSION } from "@/lib/offer-intent";

/** Doit rester aligné sur la liste du formulaire web (app/post/PostForm.tsx). */
const CONDITIONS = ["Neuf", "Très bon état", "Bon état", "État correct", "Pour pièces"];

/**
 * Référentiel de publication servi à l'application mobile.
 *
 * L'app embarque une copie de secours pour le premier lancement et le hors
 * ligne, mais c'est cette réponse qui fait foi : une catégorie ajoutée au site
 * apparaît dans l'app sans passer par l'App Store. Sans ça les deux listes
 * divergent — c'est ce qui faisait échouer la suggestion « Beauté & Bien-être »,
 * absente côté mobile.
 */
export async function GET() {
  return NextResponse.json(
    {
      categories: CATEGORIES.map((c) => ({
        id: c.id,
        label: c.label,
        subcategories: c.subcategories,
        kind: c.kind ?? "bien",
      })),
      conditions: CONDITIONS,
      /**
       * Régimes de champs. C'est ce qui permet à l'app mobile de cesser de
       * demander « État » sur une prestation, ou d'afficher un champ
       * « Caution », sans passer par l'App Store : le schéma est de la donnée,
       * pas du code compilé dans le binaire.
       */
      fieldSets: FIELD_SETS,
      intentVersion: OFFER_INTENT_VERSION,
      // Le catalogue PRO (2 200 prestations) est servi à part : trop lourd pour
      // être embarqué ici, et l'app n'en charge que la branche qu'elle ouvre.
      // On expose seulement les points d'entrée pour que le mobile les découvre.
      proCatalog: {
        outline: "/api/taxonomy/pro?view=outline",
        category: "/api/taxonomy/pro?view=category&id=",
        leaf: "/api/taxonomy/pro?view=leaf&id=",
        fields: "/api/taxonomy/pro?view=fields",
        domains: "/api/taxonomy/pro?view=domains",
        suggest: "/api/taxonomy/pro/suggest?q=",
      },
      wellness: {
        categoryId: WELLNESS_CATEGORY_ID,
        durations: WELLNESS_DURATIONS,
        priceUnits: WELLNESS_PRICE_UNITS,
        tariffTypes: WELLNESS_TARIFF_TYPES,
        places: WELLNESS_PLACES,
        onePerListingNotice: WELLNESS_ONE_PER_LISTING_NOTICE,
        maxServices: WELLNESS_MAX_SERVICES,
        maxForIndividuals: WELLNESS_MAX_FOR_INDIVIDUALS,
        proThreshold: WELLNESS_PRO_THRESHOLD,
      },
    },
    // Référentiel quasi statique : un cache court évite un aller-retour à
    // chaque ouverture du formulaire sans figer une mise à jour du site.
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
  );
}

/**
 * Intention de l'annonce, côté application.
 *
 * Le moteur lui-même vit sur le serveur (`lib/offer-intent.ts`) et n'est pas
 * recopié ici : une table de motifs dupliquée diverge, et c'est déjà ce défaut
 * — deux définitions de la même chose — qui faisait demander « État du
 * produit » pour une manucure. L'app interroge donc /api/listings/intent,
 * débouncé sur la frappe.
 *
 * Hors ligne ou serveur muet, on retombe sur le `kind` de la rubrique : moins
 * fin (il ignore le titre), jamais faux.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "./api";
import { useTaxonomy, type FieldSetSpec } from "./taxonomy";
import type { Category } from "./categories";

export type OfferIntent = {
  nature: string;
  confidence: number;
  signals: string[];
  fieldSet: string;
  suppressed: string[];
  lexicon: string;
  version: number;
};

type IntentResponse = { intent: OfferIntent; fieldSet: FieldSetSpec };

export type OfferIntentInput = {
  title: string;
  description?: string;
  category?: Category | null;
  subcategory?: string | null;
  price?: string | null;
};

/** Délai avant interrogation : assez long pour ne pas suivre chaque touche. */
const DEBOUNCE_MS = 450;

export function useOfferIntent(input: OfferIntentInput): {
  intent: OfferIntent | null;
  spec: FieldSetSpec;
  /** Vrai tant qu'on n'a que le repli local. */
  isFallback: boolean;
} {
  const { fieldSets } = useTaxonomy();
  const [remote, setRemote] = useState<IntentResponse | null>(null);
  const lastKey = useRef<string>("");

  const key = [
    input.title.trim(),
    (input.description ?? "").trim().slice(0, 400),
    input.category?.id ?? "",
    input.subcategory ?? "",
    input.price ?? "",
  ].join("|");

  useEffect(() => {
    if (input.title.trim().length < 3) {
      setRemote(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ title: input.title.trim() });
      if (input.description) params.set("description", input.description.slice(0, 2000));
      if (input.category?.id) params.set("category", input.category.id);
      if (input.subcategory) params.set("subcategory", input.subcategory);
      if (input.price) params.set("price", input.price);

      apiFetch<IntentResponse>(`/api/listings/intent?${params.toString()}`, { auth: false })
        .then((res) => {
          if (cancelled || !res?.intent) return;
          lastKey.current = key;
          setRemote(res);
        })
        .catch(() => {
          // Silence volontaire : le repli local prend le relais, et une
          // publication ne doit jamais échouer parce qu'un formulaire n'a pas
          // réussi à deviner sa propre forme.
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, input.title, input.description, input.category?.id, input.subcategory, input.price]);

  /** Repli : la rubrique seule. Ignore le titre, d'où sa confiance basse. */
  const fallbackId = input.category?.kind === "prestation" ? "prestation" : "bien";

  const spec = useMemo(() => {
    const id = remote?.intent.fieldSet ?? fallbackId;
    return fieldSets[id] ?? fieldSets[fallbackId] ?? fieldSets.bien;
  }, [remote, fallbackId, fieldSets]);

  return { intent: remote?.intent ?? null, spec, isFallback: remote === null };
}

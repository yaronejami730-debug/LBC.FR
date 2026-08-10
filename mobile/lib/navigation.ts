import { useCallback } from "react";
import { useRouter, type Href } from "expo-router";

/**
 * Retour arrière fiable.
 *
 * `router.back()` seul ne fait rien quand la pile est vide — c'est le cas
 * d'une ouverture par notification, deep link ou lien partagé, où l'écran est
 * le premier de la session. On retombe alors sur un écran racine plutôt que
 * de laisser l'utilisateur coincé.
 */
export function useGoBack(fallback: Href = "/(tabs)") {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./auth";
import { setPushMode } from "./push";

const KEY = "dealandco.admin.mode";

/**
 * Mode d'usage de l'application : utilisateur, ou administrateur.
 *
 * Un administrateur reste un utilisateur ordinaire — il vend, il achète, il
 * répond à ses messages. Lui imposer en permanence l'interface de modération
 * reviendrait à lui donner deux comptes ; d'où une bascule explicite, rangée
 * dans « Sécurité du compte », à côté du mot de passe et des appareils.
 *
 * Le mode ne donne aucun droit : il change ce que l'application affiche et le
 * type de notifications qu'elle reçoit. Toutes les routes d'administration
 * revérifient le rôle côté serveur, à chaque appel.
 */
type AdminModeState = {
  /** L'application est-elle actuellement en mode administrateur ? */
  adminMode: boolean;
  /** Le compte a-t-il le droit de basculer ? */
  canSwitch: boolean;
  loading: boolean;
  setAdminMode: (next: boolean) => Promise<void>;
};

const Ctx = createContext<AdminModeState | null>(null);

export function AdminModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const canSwitch = user?.role === "ADMIN";
  const [adminMode, setState] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(KEY).catch(() => null);
      // Un compte rétrogradé garde son réglage en mémoire : on le neutralise
      // au chargement plutôt que de laisser une interface d'administration
      // s'ouvrir sur des 403.
      setState(stored === "1" && canSwitch);
      setLoading(false);
    })();
  }, [canSwitch]);

  const setAdminMode = useCallback(
    async (next: boolean) => {
      if (!canSwitch && next) return;
      setState(next);
      await AsyncStorage.setItem(KEY, next ? "1" : "0").catch(() => {});
      // Le serveur doit savoir quoi envoyer à cet appareil : en mode
      // administrateur, ce sont les alertes de modération, pas les favoris.
      await setPushMode(next ? "admin" : "user").catch(() => {});
    },
    [canSwitch],
  );

  return (
    <Ctx.Provider value={{ adminMode: adminMode && canSwitch, canSwitch, loading, setAdminMode }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAdminMode(): AdminModeState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminMode doit être utilisé dans AdminModeProvider");
  return ctx;
}

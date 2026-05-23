import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { apiFetch } from "./api";
import { useAuth } from "./auth";

type UnreadState = { count: number; refresh: () => Promise<void> };

const Ctx = createContext<UnreadState>({ count: 0, refresh: async () => {} });

export function UnreadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    try {
      const data = await apiFetch<{ count: number }>("/api/messages/unread");
      setCount(data.count ?? 0);
    } catch {
      // silencieux
    }
  }, [user]);

  // Poll régulier — backstop léger si la notif push rate.
  useEffect(() => {
    refresh();
    if (!user) return;
    const t = setInterval(refresh, 15_000);
    const appSub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => {
      clearInterval(t);
      appSub.remove();
    };
  }, [refresh, user]);

  // Toute notif push de type "message" déclenche aussi un refresh immédiat.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((n) => {
      const data = n.request.content.data as Record<string, unknown> | undefined;
      if (data?.type === "message") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return <Ctx.Provider value={{ count, refresh }}>{children}</Ctx.Provider>;
}

export function useUnread(): UnreadState {
  return useContext(Ctx);
}

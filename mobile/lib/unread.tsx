import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { apiFetch } from "./api";
import { useAuth } from "./auth";

type UnreadState = { count: number; refresh: () => Promise<void> };

type ConvLite = {
  id: string;
  unread: boolean;
  lastMessage: { content: string; senderId: string; createdAt: string } | null;
  participants: { userId: string; user: { id: string; name: string } }[];
};

const Ctx = createContext<UnreadState>({ count: 0, refresh: async () => {} });

// Fire local notification — works in Expo Go (unlike remote push).
async function fireLocalNotif(title: string, body: string, data: Record<string, unknown>) {
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== "granted") {
      const r = await Notifications.requestPermissionsAsync();
      if (r.status !== "granted") return;
    }
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: "default" },
      trigger: null,
    });
  } catch {
    // silencieux : si expo-notifications indisponible, on garde au moins le badge
  }
}

export function UnreadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  // Conserve les IDs déjà notifiés pour ne pas spammer le même message.
  const seenMessageIds = useRef<Set<string>>(new Set());
  const lastCountRef = useRef(0);
  const firstLoadRef = useRef(true);

  const checkForNewMessages = useCallback(async () => {
    if (!user) return;
    try {
      const conversations = await apiFetch<ConvLite[]>("/api/conversations");
      const now = Date.now();
      for (const c of conversations) {
        const m = c.lastMessage;
        if (!m) continue;
        if (m.senderId === user.id) continue;
        if (!c.unread) continue;
        const key = `${c.id}:${m.createdAt}`;
        if (seenMessageIds.current.has(key)) continue;
        seenMessageIds.current.add(key);
        // Ignore old messages on first load — on ne notifie que les NOUVEAUX.
        if (firstLoadRef.current) continue;
        // Évite de notifier un message vieux de plus de 2 min (cas reload).
        if (now - new Date(m.createdAt).getTime() > 2 * 60_000) continue;
        const otherName = c.participants.find((p) => p.userId !== user.id)?.user.name ?? "Nouveau message";
        await fireLocalNotif(otherName, m.content.slice(0, 140), {
          type: "message",
          conversationId: c.id,
        });
      }
      firstLoadRef.current = false;
    } catch {
      // silencieux
    }
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    try {
      const data = await apiFetch<{ count: number }>("/api/messages/unread");
      const next = data.count ?? 0;
      // Compteur a augmenté → un nouveau message est arrivé, on cherche lequel.
      if (next > lastCountRef.current) {
        await checkForNewMessages();
      }
      lastCountRef.current = next;
      setCount(next);
    } catch {
      // silencieux
    }
  }, [user, checkForNewMessages]);

  useEffect(() => {
    // Reset state quand l'utilisateur change.
    firstLoadRef.current = true;
    seenMessageIds.current.clear();
    lastCountRef.current = 0;
    refresh();
    if (!user) return;
    // Demande permission notif dès qu'un utilisateur est connecté.
    (async () => {
      try {
        const perm = await Notifications.getPermissionsAsync();
        if (perm.status !== "granted") {
          await Notifications.requestPermissionsAsync();
        }
      } catch {
        // silencieux
      }
    })();
    const t = setInterval(refresh, 3_000);
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

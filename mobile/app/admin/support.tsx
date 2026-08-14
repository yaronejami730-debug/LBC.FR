import { useCallback, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, Alert, Modal } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { adminAction, adminData } from "@/lib/adminApi";
import { ActionButton, Empty, Tabs } from "@/components/admin/AdminScreen";
import { colors } from "@/lib/theme";

type Message = {
  id: string;
  content: string;
  fromSupport: boolean;
  createdAt: string;
  sender: { id: string; name: string | null };
};

type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  lastMessageAt: string;
  unreadForAdmin: number;
  assignedTo: { id: string; name: string | null } | null;
  listing: { id: string; title: string } | null;
  user: {
    id: string;
    name: string;
    email: string;
    isPro: boolean;
    createdAt: string;
    bannedAt: string | null;
    _count: { listings: number };
  };
  messages: Message[];
};

const TABS = [
  { value: "OPEN", label: "À traiter" },
  { value: "WAITING_USER", label: "En attente" },
  { value: "RESOLVED", label: "Résolus" },
  { value: "CLOSED", label: "Clos" },
  { value: "ALL", label: "Tous" },
];

/**
 * Support côté modération, sur le téléphone.
 *
 * C'est le cas d'usage le plus évident du mode administrateur : une question
 * simple se répond en marchant, et le client n'attend pas le lundi matin.
 */
export default function AdminSupport() {
  const router = useRouter();
  const [status, setStatus] = useState("OPEN");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [thread, setThread] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");

  const load = useCallback(async (nextStatus: string) => {
    setLoading(true);
    try {
      setError(null);
      const data = await adminData<{ tickets: Ticket[]; counts: Record<string, number> }>("support", {
        statut: nextStatus,
      });
      setTickets(data.tickets);
      setCounts(data.counts);
      // Le fil ouvert suit la liste : sans cela, répondre laisse à l'écran une
      // conversation d'avant l'envoi.
      setThread((prev) => (prev ? (data.tickets.find((t) => t.id === prev.id) ?? prev) : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(status);
    }, [load, status]),
  );

  async function run(ticket: Ticket, name: string, args: unknown[]) {
    setBusyId(ticket.id);
    try {
      await adminAction(name, ...args);
      await load(status);
    } catch (e) {
      Alert.alert("Action impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setBusyId(null);
    }
  }

  async function send() {
    const content = reply.trim();
    if (!thread || content.length < 2) return;
    setReply("");
    await run(thread, "replyToTicket", [thread.id, content]);
  }

  return (
    <View className="flex-1 bg-app">
      <View className="px-4 pt-4">
        <Tabs
          tabs={TABS.map((t) => ({
            ...t,
            count:
              t.value === "ALL"
                ? Object.values(counts).reduce((a, b) => a + b, 0)
                : (counts[t.value] ?? 0),
          }))}
          value={status}
          onChange={setStatus}
        />
      </View>

      {error && (
        <View className="mx-4 mb-2 bg-surface rounded-xl px-4 py-3">
          <Text className="text-danger text-sm">{error}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 12 }}>
        {tickets.length === 0 && !loading && <Empty label="Aucune demande dans cette file." />}

        {tickets.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => {
              setReply("");
              setThread(t);
              // Ouvrir vaut lecture, comme sur le site.
              void adminAction("markTicketRead", t.id).catch(() => {});
            }}
            className="bg-surface rounded-xl p-4 mb-2 active:opacity-70"
          >
            <View className="flex-row items-start">
              <View className="flex-1 mr-2">
                <Text className="text-on-surface font-bold" numberOfLines={1}>
                  {t.subject}
                </Text>
                <Text className="text-on-surface-variant text-xs mt-0.5" numberOfLines={1}>
                  {t.user.name} · {t.user.email}
                  {t.user.isPro ? " · pro" : ""}
                </Text>
                <Text className="text-on-surface-variant text-[11px] mt-1">
                  {t.category} · {t.messages.length} message{t.messages.length > 1 ? "s" : ""} ·{" "}
                  {new Date(t.lastMessageAt).toLocaleDateString("fr-FR")}
                  {t.assignedTo ? ` · ${t.assignedTo.name ?? "pris"}` : ""}
                </Text>
              </View>
              <View className="items-end">
                {t.unreadForAdmin > 0 && (
                  <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.primary }}>
                    <Text className="text-white text-[10px] font-bold">{t.unreadForAdmin}</Text>
                  </View>
                )}
                {t.priority === "HIGH" && (
                  <Text className="text-[10px] font-bold mt-1" style={{ color: colors.danger }}>
                    PRIORITAIRE
                  </Text>
                )}
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={thread !== null} animationType="slide" onRequestClose={() => setThread(null)}>
        <View className="flex-1 bg-app">
          <View className="px-4 py-3" style={{ backgroundColor: colors.surface }}>
            <Text className="text-on-surface font-bold" numberOfLines={1}>
              {thread?.subject}
            </Text>
            <Text className="text-on-surface-variant text-xs mt-0.5">
              {thread?.user.name} · {thread?.user.email}
            </Text>
            <Text className="text-on-surface-variant text-[11px] mt-0.5">
              Inscrit le{" "}
              {thread ? new Date(thread.user.createdAt).toLocaleDateString("fr-FR") : ""} ·{" "}
              {thread?.user._count.listings} annonce
              {(thread?.user._count.listings ?? 0) > 1 ? "s" : ""}
              {thread?.user.bannedAt ? " · compte banni" : ""}
            </Text>
            {thread && (
              <Pressable
                onPress={() => {
                  const target = thread;
                  setThread(null);
                  router.push(`/admin/client?id=${target.user.id}`);
                }}
              >
                <Text className="text-primary text-xs font-bold mt-1">Ouvrir sa fiche</Text>
              </Pressable>
            )}
          </View>

          <ScrollView contentContainerStyle={{ padding: 12 }}>
            {thread?.messages.map((m) => (
              <View
                key={m.id}
                className="rounded-2xl px-4 py-2.5 mb-2"
                style={{
                  maxWidth: "85%",
                  alignSelf: m.fromSupport ? "flex-end" : "flex-start",
                  backgroundColor: m.fromSupport ? colors.primary : colors.surface,
                }}
              >
                <Text className="text-sm" style={{ color: m.fromSupport ? "#fff" : colors.onSurface }}>
                  {m.content}
                </Text>
                <Text
                  className="text-[10px] mt-1"
                  style={{
                    color: m.fromSupport ? "rgba(255,255,255,0.7)" : colors.onSurfaceVariant,
                  }}
                >
                  {m.fromSupport ? (m.sender.name ?? "Support") : thread?.user.name} ·{" "}
                  {new Date(m.createdAt).toLocaleString("fr-FR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View className="px-3 pb-3" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row mt-3 mb-2">
              <ActionButton
                label={thread?.assignedTo ? "Relâcher" : "Je m'en occupe"}
                disabled={busyId === thread?.id}
                onPress={() => thread && run(thread, "assignTicket", [thread.id, !thread.assignedTo])}
              />
              <ActionButton
                label="Résolu"
                tone="primary"
                disabled={busyId === thread?.id}
                onPress={() => thread && run(thread, "setTicketStatus", [thread.id, "RESOLVED"])}
              />
              <ActionButton
                label={thread?.priority === "HIGH" ? "Normal" : "Prioritaire"}
                disabled={busyId === thread?.id}
                onPress={() =>
                  thread &&
                  run(thread, "setTicketPriority", [
                    thread.id,
                    thread.priority === "HIGH" ? "NORMAL" : "HIGH",
                  ])
                }
              />
            </View>

            <View className="flex-row items-end">
              <TextInput
                value={reply}
                onChangeText={setReply}
                placeholder="Votre réponse au client…"
                placeholderTextColor={colors.outline}
                multiline
                className="flex-1 rounded-xl px-3 py-2.5 text-on-surface mr-2"
                style={{ backgroundColor: colors.surfaceContainer, maxHeight: 120 }}
              />
              <Pressable
                onPress={send}
                disabled={busyId === thread?.id || reply.trim().length < 2}
                className="px-4 py-3 rounded-xl"
                style={{
                  backgroundColor: colors.primary,
                  opacity: busyId === thread?.id || reply.trim().length < 2 ? 0.5 : 1,
                }}
              >
                <Text className="text-white font-bold text-sm">Répondre</Text>
              </Pressable>
            </View>

            <Pressable onPress={() => setThread(null)} className="items-center py-3">
              <Text className="text-on-surface-variant text-sm font-bold">Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

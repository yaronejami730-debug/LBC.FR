import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { apiFetch } from "@/lib/api";
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
  status: string;
  createdAt: string;
  messages: Message[];
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "En cours de traitement",
  WAITING_USER: "Réponse du support",
  RESOLVED: "Résolue",
  CLOSED: "Close",
};

/**
 * Un fil de support.
 *
 * Ouvrir l'écran vaut lecture : le serveur remet le compteur de non-lus à zéro,
 * exactement comme sur le site. Répondre à une demande marquée résolue la
 * rouvre — c'est plus honnête qu'un bouton « rouvrir » que personne ne voit.
 */
export default function SupportThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await apiFetch<{ ticket: Ticket }>(`/api/support/tickets/${id}`);
      setTicket(data.ticket);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discussion introuvable");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function send() {
    const content = reply.trim();
    if (!content || !id) return;
    setSending(true);
    try {
      await apiFetch(`/api/support/tickets/${id}`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setReply("");
      await load();
      scrollRef.current?.scrollToEnd({ animated: true });
    } catch (e) {
      Alert.alert("Envoi impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setSending(false);
    }
  }

  async function resolve() {
    if (!id) return;
    try {
      await apiFetch(`/api/support/tickets/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "RESOLVED" }),
      });
      await load();
    } catch (e) {
      Alert.alert("Action impossible", e instanceof Error ? e.message : "Réessayez.");
    }
  }

  if (loading && !ticket) {
    return (
      <View className="flex-1 bg-app items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-app p-4">
        <View className="bg-surface rounded-xl px-4 py-3">
          <Text className="text-danger text-sm">{error}</Text>
        </View>
      </View>
    );
  }

  const closed = ticket?.status === "RESOLVED" || ticket?.status === "CLOSED";

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-app"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View className="px-4 py-3 bg-surface">
        <Text className="text-on-surface font-bold" numberOfLines={1}>
          {ticket?.subject}
        </Text>
        <View className="flex-row items-center mt-0.5">
          <Text className="text-on-surface-variant text-xs flex-1">
            {STATUS_LABELS[ticket?.status ?? ""] ?? ticket?.status}
          </Text>
          {!closed && (
            <Pressable onPress={resolve}>
              <Text className="text-primary text-xs font-bold">C&apos;est réglé</Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 12 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {ticket?.messages.map((m) => (
          <View
            key={m.id}
            className="rounded-2xl px-4 py-2.5 mb-2"
            style={{
              maxWidth: "85%",
              alignSelf: m.fromSupport ? "flex-start" : "flex-end",
              backgroundColor: m.fromSupport ? colors.surface : colors.primary,
            }}
          >
            <Text
              className="text-sm"
              style={{ color: m.fromSupport ? colors.onSurface : "#fff" }}
            >
              {m.content}
            </Text>
            <Text
              className="text-[10px] mt-1"
              style={{ color: m.fromSupport ? colors.onSurfaceVariant : "rgba(255,255,255,0.7)" }}
            >
              {m.fromSupport ? "Support Deal&Co" : "Vous"} ·{" "}
              {new Date(m.createdAt).toLocaleString("fr-FR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View className="flex-row items-end px-3 py-3" style={{ backgroundColor: colors.surface }}>
        <TextInput
          value={reply}
          onChangeText={setReply}
          placeholder={closed ? "Répondre rouvrira la demande" : "Votre message…"}
          placeholderTextColor={colors.outline}
          multiline
          className="flex-1 rounded-xl px-3 py-2.5 text-on-surface mr-2"
          style={{ backgroundColor: colors.surfaceContainer, maxHeight: 120 }}
        />
        <Pressable
          onPress={send}
          disabled={sending || !reply.trim()}
          className="px-4 py-3 rounded-xl"
          style={{ backgroundColor: colors.primary, opacity: sending || !reply.trim() ? 0.5 : 1 }}
        >
          <Text className="text-white font-bold text-sm">Envoyer</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

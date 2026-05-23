import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { timeAgo } from "@/lib/format";

type Message = {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  createdAt: string;
  flagged?: boolean;
};

export default function ConversationScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const lastSeenRef = useRef<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const fetchMessages = useCallback(
    async (cursor?: string | null) => {
      if (!conversationId) return;
      const qs = new URLSearchParams({ conversationId });
      if (cursor) qs.set("after", cursor);
      const data = await apiFetch<Message[]>(`/api/messages?${qs.toString()}`);
      if (data.length > 0) {
        lastSeenRef.current = data[data.length - 1].id;
        setMessages((prev) => (cursor ? [...prev, ...data] : data));
      } else if (!cursor) {
        setMessages([]);
      }
    },
    [conversationId],
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await fetchMessages();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchMessages]);

  // Polling for new messages — light, simple. SSE possible plus tard.
  useEffect(() => {
    const t = setInterval(() => {
      fetchMessages(lastSeenRef.current).catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [fetchMessages]);

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText("");
    try {
      const msg = await apiFetch<Message>("/api/messages", {
        method: "POST",
        body: JSON.stringify({ conversationId, content }),
      });
      setMessages((prev) => [...prev, msg]);
      lastSeenRef.current = msg.id;
    } catch (e) {
      setText(content);
      setError(e instanceof Error ? e.message : "Échec de l'envoi");
    } finally {
      setSending(false);
    }
  };

  if (!user) {
    return (
      <View className="flex-1 bg-surface items-center justify-center px-6">
        <Text className="text-on-surface text-center mb-4">Connectez-vous pour discuter.</Text>
        <Pressable onPress={() => router.push("/(auth)/login")} className="bg-primary px-6 py-3 rounded-full">
          <Text className="text-white font-bold">Se connecter</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-surface">
      <Stack.Screen options={{ title: "Conversation", headerBackTitle: "Retour" }} />

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#2f6fb8" /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 16 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <Text className="text-on-surface-variant text-center mt-12">Commencez la discussion.</Text>
          }
          renderItem={({ item }) => {
            const mine = item.senderId === user.id;
            return (
              <View className={`my-1 max-w-[80%] ${mine ? "self-end" : "self-start"}`}>
                <View
                  className={`px-3 py-2 rounded-2xl ${mine ? "bg-primary rounded-br-sm" : "bg-surface-container rounded-bl-sm"}`}
                >
                  <Text className={mine ? "text-white" : "text-on-surface"}>{item.content}</Text>
                </View>
                <Text className={`text-[10px] mt-0.5 ${mine ? "text-right text-on-surface-variant" : "text-on-surface-variant"}`}>
                  {timeAgo(item.createdAt)}
                  {item.flagged ? " · signalé" : ""}
                </Text>
              </View>
            );
          }}
        />
      )}

      {error && (
        <View className="px-3 py-2 bg-red-50 border-t border-red-200">
          <Text className="text-red-700 text-xs">{error}</Text>
        </View>
      )}

      <View className="flex-row items-center gap-2 p-2 border-t border-surface-container">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Votre message…"
          placeholderTextColor="#94a3b8"
          multiline
          className="flex-1 bg-surface-container rounded-2xl px-3 py-2 text-on-surface max-h-32"
        />
        <Pressable
          onPress={send}
          disabled={sending || !text.trim()}
          className={`px-4 py-2.5 rounded-full ${sending || !text.trim() ? "bg-surface-container" : "bg-primary"}`}
        >
          <Text className={`font-bold ${sending || !text.trim() ? "text-outline" : "text-white"}`}>Envoyer</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  Modal,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { apiFetch } from "@/lib/api";
import { colors } from "@/lib/theme";

type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  lastMessageAt: string;
  unreadForUser: number;
  createdAt: string;
  lastMessage: { content: string; fromSupport: boolean } | null;
};

const CATEGORIES = [
  { value: "compte", label: "Mon compte" },
  { value: "annonce", label: "Une annonce" },
  { value: "securite", label: "Sécurité, arnaque" },
  { value: "paiement", label: "Paiement, facturation" },
  { value: "pro", label: "Compte professionnel" },
  { value: "technique", label: "Problème technique" },
  { value: "autre", label: "Autre" },
];

const STATUS_LABELS: Record<string, string> = {
  OPEN: "En cours de traitement",
  WAITING_USER: "Réponse du support",
  RESOLVED: "Résolue",
  CLOSED: "Close",
};

/**
 * Mes discussions avec le support.
 *
 * Le même fil que sur le site, servi par la même API : une question posée
 * depuis le téléphone se retrouve au bureau, et inversement.
 */
export default function SupportList() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("autre");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch<{ tickets: Ticket[] }>("/api/support/tickets");
      setTickets(data.tickets);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function create() {
    setSending(true);
    try {
      const data = await apiFetch<{ ticket: { id: string } }>("/api/support/tickets", {
        method: "POST",
        body: JSON.stringify({ subject, category, message }),
      });
      setComposing(false);
      setSubject("");
      setMessage("");
      await load();
      router.push(`/support/${data.ticket.id}`);
    } catch (e) {
      Alert.alert("Envoi impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setSending(false);
    }
  }

  if (loading && tickets.length === 0) {
    return (
      <View className="flex-1 bg-app items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-app">
      <View className="px-4 pt-4">
        <Pressable
          onPress={() => setComposing(true)}
          className="rounded-xl items-center py-3 active:opacity-70"
          style={{ backgroundColor: colors.primary }}
        >
          <Text className="text-white font-bold">Nouvelle demande</Text>
        </Pressable>
      </View>

      {error && (
        <View className="mx-4 mt-3 bg-surface rounded-xl px-4 py-3">
          <Text className="text-danger text-sm">{error}</Text>
        </View>
      )}

      <FlatList
        data={tickets}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: 12 }}
        refreshing={loading}
        onRefresh={load}
        ListEmptyComponent={
          <View className="items-center mt-12 px-6">
            <Ionicons name="chatbubbles-outline" size={30} color={colors.outline} />
            <Text className="text-on-surface-variant text-center mt-2">
              Aucune demande. Une vraie personne vous répond, en général sous 24 heures.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/support/${item.id}`)}
            className="bg-surface rounded-xl p-4 mb-2 active:opacity-70"
          >
            <View className="flex-row items-start">
              <View className="flex-1 mr-2">
                <Text className="text-on-surface font-bold" numberOfLines={1}>
                  {item.subject}
                </Text>
                <Text className="text-on-surface-variant text-xs mt-0.5" numberOfLines={1}>
                  {item.lastMessage
                    ? `${item.lastMessage.fromSupport ? "Support : " : ""}${item.lastMessage.content}`
                    : "—"}
                </Text>
                <Text className="text-on-surface-variant text-[11px] mt-1">
                  {STATUS_LABELS[item.status] ?? item.status} ·{" "}
                  {new Date(item.lastMessageAt).toLocaleDateString("fr-FR")}
                </Text>
              </View>
              {item.unreadForUser > 0 && (
                <View
                  className="px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Text className="text-white text-[10px] font-bold">{item.unreadForUser}</Text>
                </View>
              )}
            </View>
          </Pressable>
        )}
      />

      <Modal visible={composing} animationType="slide" onRequestClose={() => setComposing(false)}>
        <ScrollView className="flex-1 bg-app" contentContainerStyle={{ padding: 16 }}>
          <Text className="text-on-surface text-xl font-extrabold mb-1">Écrire au support</Text>
          <Text className="text-on-surface-variant text-xs mb-4">
            Vous recevrez la réponse ici, par notification et par email.
          </Text>

          <Text className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-1.5">
            Sujet
          </Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="Ex. Je n'arrive pas à publier une annonce"
            placeholderTextColor={colors.outline}
            className="rounded-xl px-3 py-3 text-on-surface mb-3"
            style={{ backgroundColor: colors.surfaceContainer }}
          />

          <Text className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-1.5">
            Rubrique
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.value}
                onPress={() => setCategory(c.value)}
                className="mr-2 px-3 py-1.5 rounded-full"
                style={{ backgroundColor: category === c.value ? colors.primary : colors.surface }}
              >
                <Text
                  className="text-xs font-bold"
                  style={{ color: category === c.value ? "#fff" : colors.onSurfaceVariant }}
                >
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-1.5">
            Votre message
          </Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Décrivez ce qui se passe. Plus c'est précis, plus la réponse est rapide."
            placeholderTextColor={colors.outline}
            multiline
            className="rounded-xl px-3 py-3 text-on-surface mb-4"
            style={{ backgroundColor: colors.surfaceContainer, minHeight: 160 }}
          />

          <View className="flex-row">
            <Pressable
              onPress={() => setComposing(false)}
              className="flex-1 items-center py-3 rounded-xl mr-2"
              style={{ backgroundColor: colors.surfaceContainer }}
            >
              <Text className="font-bold text-sm" style={{ color: colors.onSurfaceVariant }}>
                Annuler
              </Text>
            </Pressable>
            <Pressable
              onPress={create}
              disabled={sending || subject.trim().length < 3 || message.trim().length < 10}
              className="flex-1 items-center py-3 rounded-xl"
              style={{
                backgroundColor: colors.primary,
                opacity: sending || subject.trim().length < 3 || message.trim().length < 10 ? 0.5 : 1,
              }}
            >
              <Text className="text-white font-bold text-sm">{sending ? "Envoi…" : "Envoyer"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

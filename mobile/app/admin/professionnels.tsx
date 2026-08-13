import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { apiFetch } from "@/lib/api";
import { colors } from "@/lib/theme";

type ProRequest = {
  id: string;
  status: string;
  submittedAt: string;
  companyName: string;
  commercialName: string | null;
  siret: string;
  siretPreviouslyBanned: boolean;
  businessActivity: string | null;
  infoRequest: string | null;
  rejectionReason: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    professionalStatus: string;
    _count: { listings: number };
  };
};

const TABS = [
  { value: "PENDING", label: "À vérifier" },
  { value: "INFO_REQUESTED", label: "Infos demandées" },
  { value: "APPROVED", label: "Vérifiés" },
  { value: "REJECTED", label: "Refusés" },
];

/**
 * Dossiers d'habilitation professionnelle.
 *
 * Les pièces d'identité ne descendent pas dans l'application : elles restent
 * sur le site. On décide ici sur le contexte — entreprise, SIRET, ancienneté du
 * compte, nombre d'annonces — ou l'on réclame une précision, ce qui est de loin
 * le geste le plus fréquent et le plus coûteux à reporter.
 */
export default function AdminProfessionnels() {
  const [status, setStatus] = useState("PENDING");
  const [items, setItems] = useState<ProRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Dossier en cours de saisie d'un motif, et nature de la décision. */
  const [prompt, setPrompt] = useState<{ item: ProRequest; action: "refuse" | "request-info" } | null>(
    null,
  );
  const [reason, setReason] = useState("");

  const load = useCallback(async (nextStatus: string) => {
    setLoading(true);
    try {
      setError(null);
      const data = await apiFetch<{ requests: ProRequest[] }>(
        `/api/mobile/admin/pros?status=${nextStatus}`,
      );
      setItems(data.requests);
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

  async function decide(item: ProRequest, action: string, motif?: string) {
    setBusyId(item.id);
    try {
      await apiFetch("/api/mobile/admin/pros", {
        method: "POST",
        body: JSON.stringify({ userId: item.user.id, action, reason: motif }),
      });
      setItems((prev) => prev.filter((r) => r.id !== item.id));
    } catch (e) {
      Alert.alert("Action impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View className="flex-1 bg-app">
      <View className="flex-row px-3 pt-3 pb-1">
        {TABS.map((t) => (
          <Pressable
            key={t.value}
            onPress={() => setStatus(t.value)}
            className="mr-2 px-3 py-1.5 rounded-full"
            style={{ backgroundColor: status === t.value ? colors.primary : colors.surface }}
          >
            <Text
              className="text-xs font-bold"
              style={{ color: status === t.value ? "#fff" : colors.onSurfaceVariant }}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {error && (
        <View className="mx-3 my-2 bg-surface rounded-xl px-4 py-3">
          <Text className="text-danger text-sm">{error}</Text>
        </View>
      )}

      {loading && items.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 12 }}
          refreshing={loading}
          onRefresh={() => load(status)}
          ListEmptyComponent={
            <Text className="text-on-surface-variant text-center mt-10">Aucun dossier dans cette file.</Text>
          }
          renderItem={({ item }) => (
            <View className="bg-surface rounded-xl p-4 mb-2">
              <Text className="text-on-surface font-bold">
                {item.commercialName || item.companyName}
              </Text>
              <Text className="text-on-surface-variant text-xs mt-0.5">
                SIRET {item.siret}
                {item.businessActivity ? ` · ${item.businessActivity}` : ""}
              </Text>
              <Text className="text-on-surface-variant text-xs mt-1">
                {item.user.name} · {item.user.email}
              </Text>
              <Text className="text-on-surface-variant text-xs mt-0.5">
                Compte du {new Date(item.user.createdAt).toLocaleDateString("fr-FR")} ·{" "}
                {item.user._count.listings} annonce{item.user._count.listings > 1 ? "s" : ""} · email{" "}
                {item.user.emailVerified ? "vérifié" : "non vérifié"}
              </Text>

              {item.siretPreviouslyBanned && (
                <Text className="text-xs mt-2" style={{ color: colors.danger }}>
                  Ce SIRET a déjà servi à un compte banni — à examiner avec attention, ce n&apos;est
                  pas une preuve.
                </Text>
              )}
              {item.infoRequest && (
                <Text className="text-on-surface-variant text-xs mt-2 italic">
                  Demande en cours : {item.infoRequest}
                </Text>
              )}

              {(item.status === "PENDING" || item.status === "INFO_REQUESTED") && (
                <>
                  <View className="flex-row mt-3">
                    <Pressable
                      onPress={() => decide(item, "approve")}
                      disabled={busyId === item.id}
                      className="flex-1 items-center py-2.5 rounded-xl mr-2"
                      style={{ backgroundColor: colors.primary, opacity: busyId === item.id ? 0.5 : 1 }}
                    >
                      <Text className="text-white font-bold text-sm">Habiliter</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setReason("");
                        setPrompt({ item, action: "refuse" });
                      }}
                      disabled={busyId === item.id}
                      className="flex-1 items-center py-2.5 rounded-xl"
                      style={{ backgroundColor: colors.surfaceContainer, opacity: busyId === item.id ? 0.5 : 1 }}
                    >
                      <Text className="font-bold text-sm" style={{ color: colors.danger }}>
                        Refuser
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => {
                      setReason("");
                      setPrompt({ item, action: "request-info" });
                    }}
                    disabled={busyId === item.id}
                    className="items-center py-2.5 rounded-xl mt-2"
                    style={{ backgroundColor: colors.surfaceContainer, opacity: busyId === item.id ? 0.5 : 1 }}
                  >
                    <Text className="font-bold text-sm" style={{ color: colors.onSurfaceVariant }}>
                      Demander une pièce
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        />
      )}

      <Modal visible={prompt !== null} transparent animationType="slide" onRequestClose={() => setPrompt(null)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.35)" }}>
          <View className="bg-surface rounded-t-2xl p-5">
            <Text className="text-on-surface font-bold text-base">
              {prompt?.action === "refuse" ? "Refuser l'habilitation" : "Demander une pièce"}
            </Text>
            <Text className="text-on-surface-variant text-xs mt-1">
              {prompt?.item.commercialName || prompt?.item.companyName}
            </Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder={
                prompt?.action === "refuse"
                  ? "Motif communiqué au professionnel"
                  : "Ce qui manque au dossier"
              }
              placeholderTextColor={colors.outline}
              multiline
              className="mt-3 rounded-xl px-3 py-3 text-on-surface"
              style={{ backgroundColor: colors.surfaceContainer, minHeight: 90 }}
            />
            <View className="flex-row mt-4">
              <Pressable
                onPress={() => setPrompt(null)}
                className="flex-1 items-center py-3 rounded-xl mr-2"
                style={{ backgroundColor: colors.surfaceContainer }}
              >
                <Text className="font-bold text-sm" style={{ color: colors.onSurfaceVariant }}>
                  Annuler
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const motif = reason.trim();
                  // Le serveur refuse en dessous de cinq caractères : autant le
                  // dire ici plutôt que d'aller chercher une erreur réseau.
                  if (motif.length < 5) {
                    Alert.alert("Motif requis", "Expliquez en une phrase ce qui est demandé.");
                    return;
                  }
                  const target = prompt;
                  setPrompt(null);
                  if (target) void decide(target.item, target.action, motif);
                }}
                className="flex-1 items-center py-3 rounded-xl"
                style={{
                  backgroundColor: prompt?.action === "refuse" ? colors.danger : colors.primary,
                }}
              >
                <Text className="text-white font-bold text-sm">
                  {prompt?.action === "refuse" ? "Refuser" : "Envoyer"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

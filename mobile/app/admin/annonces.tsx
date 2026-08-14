import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { apiFetch } from "@/lib/api";
import { adminAction, adminData } from "@/lib/adminApi";
import { colors } from "@/lib/theme";

type AdminListing = {
  id: string;
  title: string;
  price: number;
  images: string[];
  category: string;
  subcategory: string | null;
  location: string;
  status: string;
  createdAt: string;
  riskScore: number;
  user: { id: string; name: string; email: string; isPro: boolean; verified: boolean };
};

const TABS = [
  { value: "PENDING", label: "En attente" },
  { value: "UNDER_REVIEW", label: "En revue" },
  { value: "APPROVED", label: "En ligne" },
  { value: "REJECTED", label: "Refusées" },
];

/**
 * File de modération des annonces.
 *
 * Deux gestes seulement : valider, refuser. C'est ce qu'on fait debout dans le
 * métro ; tout ce qui demande de comparer, croiser ou enquêter reste sur le
 * site, où l'écran est assez grand pour le faire sérieusement.
 */
export default function AdminAnnonces() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const [status, setStatus] = useState(params.status ?? "PENDING");
  const [items, setItems] = useState<AdminListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextStatus: string) => {
    setLoading(true);
    try {
      setError(null);
      const data = await apiFetch<{ listings: AdminListing[] }>(
        `/api/mobile/admin/listings?status=${nextStatus}`,
      );
      setItems(data.listings);
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

  async function decide(item: AdminListing, action: "approve" | "reject", reason?: string) {
    setBusyId(item.id);
    try {
      await apiFetch(`/api/mobile/admin/listings/${item.id}`, {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      });
      // L'annonce quitte la file : la retirer tout de suite évite de trancher
      // deux fois sur le même dossier.
      setItems((prev) => prev.filter((l) => l.id !== item.id));
    } catch (e) {
      Alert.alert("Action impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Saisie du motif de refus.
   *
   * Une feuille maison plutôt que `Alert.prompt` : celui-ci n'existe que sur
   * iOS, et un refus sans motif n'apprend rien à l'auteur de l'annonce.
   */
  const [rejecting, setRejecting] = useState<AdminListing | null>(null);
  const [reason, setReason] = useState("");

  /**
   * Édition d'une annonce par l'administrateur.
   *
   * Corriger un titre trompeur ou un prix aberrant vaut mieux que de refuser :
   * l'annonce reste en ligne et le vendeur n'a rien à recommencer.
   */
  const [editing, setEditing] = useState<AdminListing | null>(null);
  const [form, setForm] = useState({ title: "", price: "", description: "", location: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  async function openEdit(item: AdminListing) {
    setEditing(item);
    setForm({ title: item.title, price: String(item.price), description: "", location: item.location });
    try {
      const data = await adminData<{ listing?: { description: string } }>("listing", { id: item.id });
      if (data.listing) setForm((p) => ({ ...p, description: data.listing!.description }));
    } catch {
      // La description manquante n'empêche pas de corriger le titre ou le prix.
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setSavingEdit(true);
    try {
      await adminAction("updateListingByAdmin", editing.id, {
        title: form.title.trim(),
        price: Number(form.price) || 0,
        description: form.description.trim(),
        location: form.location.trim(),
      });
      setEditing(null);
      await load(status);
    } catch (e) {
      Alert.alert("Enregistrement impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setSavingEdit(false);
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
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12 }}
          refreshing={loading}
          onRefresh={() => load(status)}
          ListEmptyComponent={
            <Text className="text-on-surface-variant text-center mt-10">
              Rien à traiter dans cette file.
            </Text>
          }
          renderItem={({ item }) => (
            <View className="bg-surface rounded-xl p-3 mb-2">
              <Pressable
                className="flex-row active:opacity-70"
                onPress={() => router.push(`/annonce/${item.id}`)}
              >
                {item.images[0] ? (
                  <Image
                    source={{ uri: item.images[0] }}
                    style={{ width: 64, height: 64, borderRadius: 10 }}
                  />
                ) : (
                  <View
                    style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: colors.surfaceContainer }}
                    className="items-center justify-center"
                  >
                    <Ionicons name="image-outline" size={20} color={colors.outline} />
                  </View>
                )}
                <View className="flex-1 ml-3">
                  <Text className="text-on-surface font-semibold" numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text className="text-primary font-bold mt-0.5">
                    {item.price.toLocaleString("fr-FR")} €
                  </Text>
                  <Text className="text-on-surface-variant text-xs mt-0.5" numberOfLines={1}>
                    {item.category}
                    {item.subcategory ? ` · ${item.subcategory}` : ""} · {item.location}
                  </Text>
                  <Text className="text-on-surface-variant text-xs mt-0.5" numberOfLines={1}>
                    {item.user.name}
                    {item.user.isPro ? " · pro" : ""}
                    {item.riskScore > 0 ? ` · risque ${item.riskScore}` : ""}
                  </Text>
                </View>
              </Pressable>

              <View className="flex-row mt-3">
                <Pressable
                  onPress={() => openEdit(item)}
                  className="flex-1 items-center py-2.5 rounded-xl mr-2"
                  style={{ backgroundColor: colors.surfaceContainer }}
                >
                  <Text className="font-bold text-xs" style={{ color: colors.onSurfaceVariant }}>
                    Modifier
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    Alert.alert("Supprimer l'annonce", `« ${item.title} » sera retirée du site.`, [
                      { text: "Annuler", style: "cancel" },
                      {
                        text: "Supprimer",
                        style: "destructive",
                        onPress: async () => {
                          try {
                            await adminAction("deleteListingByAdmin", item.id);
                            setItems((prev) => prev.filter((l) => l.id !== item.id));
                          } catch (e) {
                            Alert.alert(
                              "Suppression impossible",
                              e instanceof Error ? e.message : "Réessayez.",
                            );
                          }
                        },
                      },
                    ])
                  }
                  className="flex-1 items-center py-2.5 rounded-xl"
                  style={{ backgroundColor: colors.surfaceContainer }}
                >
                  <Text className="font-bold text-xs" style={{ color: colors.danger }}>
                    Supprimer
                  </Text>
                </Pressable>
              </View>

              {(item.status === "PENDING" || item.status === "UNDER_REVIEW") && (
                <View className="flex-row mt-2">
                  <Pressable
                    onPress={() => decide(item, "approve")}
                    disabled={busyId === item.id}
                    className="flex-1 items-center py-2.5 rounded-xl mr-2"
                    style={{ backgroundColor: colors.primary, opacity: busyId === item.id ? 0.5 : 1 }}
                  >
                    <Text className="text-white font-bold text-sm">Valider</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setReason("");
                      setRejecting(item);
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
              )}
            </View>
          )}
        />
      )}

      <Modal visible={editing !== null} animationType="slide" onRequestClose={() => setEditing(null)}>
        <ScrollView className="flex-1 bg-app" contentContainerStyle={{ padding: 16 }}>
          <Text className="text-on-surface text-xl font-extrabold mb-3">Modifier l&apos;annonce</Text>

          <Text className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-1.5">
            Titre
          </Text>
          <TextInput
            value={form.title}
            onChangeText={(v) => setForm((p) => ({ ...p, title: v }))}
            className="rounded-xl px-3 py-3 text-on-surface mb-3"
            style={{ backgroundColor: colors.surfaceContainer }}
          />

          <Text className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-1.5">
            Prix (€)
          </Text>
          <TextInput
            value={form.price}
            onChangeText={(v) => setForm((p) => ({ ...p, price: v }))}
            keyboardType="numeric"
            className="rounded-xl px-3 py-3 text-on-surface mb-3"
            style={{ backgroundColor: colors.surfaceContainer }}
          />

          <Text className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-1.5">
            Localisation
          </Text>
          <TextInput
            value={form.location}
            onChangeText={(v) => setForm((p) => ({ ...p, location: v }))}
            className="rounded-xl px-3 py-3 text-on-surface mb-3"
            style={{ backgroundColor: colors.surfaceContainer }}
          />

          <Text className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-1.5">
            Description
          </Text>
          <TextInput
            value={form.description}
            onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
            multiline
            className="rounded-xl px-3 py-3 text-on-surface mb-3"
            style={{ backgroundColor: colors.surfaceContainer, minHeight: 160 }}
          />

          <View className="flex-row">
            <Pressable
              onPress={() => setEditing(null)}
              className="flex-1 items-center py-3 rounded-xl mr-2"
              style={{ backgroundColor: colors.surfaceContainer }}
            >
              <Text className="font-bold text-sm" style={{ color: colors.onSurfaceVariant }}>
                Annuler
              </Text>
            </Pressable>
            <Pressable
              onPress={saveEdit}
              disabled={savingEdit}
              className="flex-1 items-center py-3 rounded-xl"
              style={{ backgroundColor: colors.primary, opacity: savingEdit ? 0.5 : 1 }}
            >
              <Text className="text-white font-bold text-sm">
                {savingEdit ? "Enregistrement…" : "Enregistrer"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </Modal>

      <Modal visible={rejecting !== null} transparent animationType="slide" onRequestClose={() => setRejecting(null)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.35)" }}>
          <View className="bg-surface rounded-t-2xl p-5">
            <Text className="text-on-surface font-bold text-base">Refuser l&apos;annonce</Text>
            <Text className="text-on-surface-variant text-xs mt-1" numberOfLines={2}>
              {rejecting?.title}
            </Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Motif communiqué à l'auteur"
              placeholderTextColor={colors.outline}
              multiline
              className="mt-3 rounded-xl px-3 py-3 text-on-surface"
              style={{ backgroundColor: colors.surfaceContainer, minHeight: 90 }}
            />
            <View className="flex-row mt-4">
              <Pressable
                onPress={() => setRejecting(null)}
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
                  if (motif.length < 3) {
                    Alert.alert("Motif requis", "Expliquez en une phrase ce qui ne va pas.");
                    return;
                  }
                  const target = rejecting;
                  setRejecting(null);
                  if (target) void decide(target, "reject", motif);
                }}
                className="flex-1 items-center py-3 rounded-xl"
                style={{ backgroundColor: colors.danger }}
              >
                <Text className="text-white font-bold text-sm">Refuser</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

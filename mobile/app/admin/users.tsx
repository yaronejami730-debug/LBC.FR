import { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, TextInput, Alert, Modal } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { adminAction, adminData } from "@/lib/adminApi";
import { ActionButton, Empty } from "@/components/admin/AdminScreen";
import { colors } from "@/lib/theme";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isPro: boolean;
  companyName: string | null;
  siret: string | null;
  verified: boolean;
  adminNote: string | null;
  bannedAt: string | null;
  banReason: string | null;
  createdAt: string;
  _count: { listings: number };
  activeCount: number;
  pendingCount: number;
};

type Payload = {
  users: AdminUser[];
  totals: { total: number; verified: number; pro: number; particuliers: number };
};

/**
 * Utilisateurs — même liste et mêmes décisions que `/admin/users`.
 *
 * Accorder le badge, le retirer, bannir, lever un bannissement : les quatre
 * gestes du site, appelés par les mêmes fonctions serveur.
 */
export default function AdminUsers() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  /** Saisie d'un motif : bannir et retirer un badge s'expliquent. */
  const [prompt, setPrompt] = useState<{ user: AdminUser; action: "ban" | "reject" } | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      setError(null);
      setData(await adminData<Payload>("users", { q }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(search);
      // La recherche ne se relance pas au retour sur l'écran : elle est pilotée
      // par le bouton, comme sur le site.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  async function run(user: AdminUser, name: string, args: unknown[], patch: Partial<AdminUser>) {
    setBusyId(user.id);
    try {
      await adminAction(name, ...args);
      setData((prev) =>
        prev ? { ...prev, users: prev.users.map((u) => (u.id === user.id ? { ...u, ...patch } : u)) } : prev,
      );
    } catch (e) {
      Alert.alert("Action impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View className="flex-1 bg-app">
      <View className="flex-row px-4 pt-4 pb-2">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Nom, email, enseigne, SIRET…"
          placeholderTextColor={colors.outline}
          onSubmitEditing={() => load(search)}
          className="flex-1 rounded-xl px-3 py-2.5 text-on-surface mr-2"
          style={{ backgroundColor: colors.surface }}
        />
        <Pressable
          onPress={() => load(search)}
          className="px-4 justify-center rounded-xl"
          style={{ backgroundColor: colors.primary }}
        >
          <Text className="text-white font-bold text-sm">Chercher</Text>
        </Pressable>
      </View>

      {data && (
        <Text className="text-on-surface-variant text-xs px-4 pb-2">
          {data.totals.total} comptes · {data.totals.pro} pro · {data.totals.particuliers} particuliers ·{" "}
          {data.totals.verified} vérifiés
        </Text>
      )}

      {error && (
        <View className="mx-4 mb-2 bg-surface rounded-xl px-4 py-3">
          <Text className="text-danger text-sm">{error}</Text>
        </View>
      )}

      <FlatList
        data={data?.users ?? []}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ padding: 12 }}
        refreshing={loading}
        onRefresh={() => load(search)}
        ListEmptyComponent={<Empty label="Aucun compte." />}
        renderItem={({ item }) => (
          <View className="bg-surface rounded-xl p-4 mb-2">
            <Pressable onPress={() => router.push(`/admin/client?id=${item.id}`)}>
              <Text className="text-primary text-[11px] font-bold uppercase tracking-wider mb-1">
                Ouvrir la fiche
              </Text>
            </Pressable>
            <Text className="text-on-surface font-bold">
              {item.isPro && item.companyName ? item.companyName : item.name}
              {item.role === "ADMIN" ? " · admin" : ""}
            </Text>
            <Text className="text-on-surface-variant text-xs mt-0.5">{item.email}</Text>
            <Text className="text-on-surface-variant text-xs mt-0.5">
              {item._count.listings} annonce{item._count.listings > 1 ? "s" : ""} · {item.activeCount} active
              {item.activeCount > 1 ? "s" : ""} · {item.pendingCount} en attente
              {item.siret ? ` · SIRET ${item.siret}` : ""}
            </Text>
            {item.bannedAt && (
              <Text className="text-xs mt-1" style={{ color: colors.danger }}>
                Banni — {item.banReason ?? "sans motif"}
              </Text>
            )}
            {item.adminNote && (
              <Text className="text-on-surface-variant text-xs mt-1 italic">{item.adminNote}</Text>
            )}

            <View className="flex-row mt-3">
              {item.verified ? (
                <ActionButton
                  label="Retirer le badge"
                  disabled={busyId === item.id}
                  onPress={() => {
                    setReason("");
                    setPrompt({ user: item, action: "reject" });
                  }}
                />
              ) : (
                <ActionButton
                  label="Vérifier"
                  tone="primary"
                  disabled={busyId === item.id}
                  onPress={() => run(item, "verifyUser", [item.id], { verified: true })}
                />
              )}
              {item.bannedAt ? (
                <ActionButton
                  label="Lever le ban"
                  disabled={busyId === item.id}
                  onPress={() => run(item, "unbanUser", [item.id], { bannedAt: null, banReason: null })}
                />
              ) : (
                <ActionButton
                  label="Bannir"
                  tone="danger"
                  disabled={busyId === item.id || item.role === "ADMIN"}
                  onPress={() => {
                    setReason("");
                    setPrompt({ user: item, action: "ban" });
                  }}
                />
              )}
            </View>
          </View>
        )}
      />

      <Modal visible={prompt !== null} transparent animationType="slide" onRequestClose={() => setPrompt(null)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.35)" }}>
          <View className="bg-surface rounded-t-2xl p-5">
            <Text className="text-on-surface font-bold text-base">
              {prompt?.action === "ban" ? "Bannir le compte" : "Retirer le badge"}
            </Text>
            <Text className="text-on-surface-variant text-xs mt-1">{prompt?.user.email}</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Motif (conservé dans l'historique)"
              placeholderTextColor={colors.outline}
              multiline
              className="mt-3 rounded-xl px-3 py-3 text-on-surface"
              style={{ backgroundColor: colors.surfaceContainer, minHeight: 90 }}
            />
            <View className="flex-row mt-4">
              <ActionButton label="Annuler" onPress={() => setPrompt(null)} />
              <ActionButton
                label="Confirmer"
                tone={prompt?.action === "ban" ? "danger" : "primary"}
                onPress={() => {
                  const motif = reason.trim();
                  if (motif.length < 3) {
                    Alert.alert("Motif requis", "Expliquez en une phrase.");
                    return;
                  }
                  const target = prompt;
                  setPrompt(null);
                  if (!target) return;
                  if (target.action === "ban") {
                    void run(target.user, "banUser", [target.user.id, motif], {
                      bannedAt: new Date().toISOString(),
                      banReason: motif,
                    });
                  } else {
                    void run(target.user, "rejectUser", [target.user.id, motif], { verified: false });
                  }
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

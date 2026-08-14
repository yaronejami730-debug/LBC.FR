import { useCallback, useState } from "react";
import { View, Text, ScrollView, Alert, Modal, TextInput, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { adminAction, adminData } from "@/lib/adminApi";
import { ActionButton, Empty, Tabs } from "@/components/admin/AdminScreen";
import { colors } from "@/lib/theme";

type Counters = {
  openReports: number;
  reportedListings: number;
  pendingListings: number;
  watched: number;
  banned: number;
  removed: number;
  rejected: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Item = any;

/** Mêmes onglets que le centre de sécurité du site, dans le même ordre. */
const TABS = [
  { value: "signalements", label: "Signalements" },
  { value: "retirees", label: "Retirées" },
  { value: "refusees", label: "Refusées" },
  { value: "surveillance", label: "Sous surveillance" },
  { value: "bannis", label: "Bannis" },
  { value: "historique", label: "Historique" },
];

/**
 * Centre de sécurité — l'état de la modération, et les décisions qui vont avec.
 *
 * Retirer, remettre en ligne, mettre en revue, surveiller un compte, bannir :
 * ce sont les actions du site, appelées telles quelles.
 */
export default function AdminSecurite() {
  const router = useRouter();
  const [tab, setTab] = useState("signalements");
  const [counters, setCounters] = useState<Counters | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [prompt, setPrompt] = useState<{ item: Item; action: string; title: string } | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async (nextTab: string) => {
    setLoading(true);
    try {
      setError(null);
      const data = await adminData<{ counters: Counters; items: Item[] }>("securite", { tab: nextTab });
      setCounters(data.counters);
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(tab);
    }, [load, tab]),
  );

  async function run(id: string, name: string, args: unknown[]) {
    setBusyId(id);
    try {
      await adminAction(name, ...args);
      await load(tab);
    } catch (e) {
      Alert.alert("Action impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View className="flex-1 bg-app">
      <View className="px-4 pt-4">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </View>

      {counters && (
        <Text className="text-on-surface-variant text-xs px-4 pb-2">
          {counters.openReports} signalements ouverts · {counters.pendingListings} en attente ·{" "}
          {counters.removed} retirées · {counters.rejected} refusées · {counters.watched} surveillés ·{" "}
          {counters.banned} bannis
        </Text>
      )}

      {error && (
        <View className="mx-4 mb-2 bg-surface rounded-xl px-4 py-3">
          <Text className="text-danger text-sm">{error}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 12 }}>
        {items.length === 0 && !loading && <Empty label="Rien dans cet onglet." />}

        {tab === "signalements" &&
          items.map((r: Item) => (
            <View key={r.id} className="bg-surface rounded-xl p-4 mb-2">
              <Text className="text-on-surface font-bold text-sm">{r.category}</Text>
              {r.listing && (
                <Pressable onPress={() => router.push(`/annonce/${r.listing.id}`)}>
                  <Text className="text-on-surface text-sm mt-1" numberOfLines={2}>
                    {r.listing.title}
                  </Text>
                  <Text className="text-on-surface-variant text-xs">
                    {r.listing.reportCount} signalement{r.listing.reportCount > 1 ? "s" : ""} au total
                  </Text>
                </Pressable>
              )}
              {r.message && (
                <Text className="text-on-surface-variant text-xs mt-1 italic">« {r.message} »</Text>
              )}
              {r.listing && (
                <View className="flex-row mt-3">
                  <ActionButton
                    label="Laisser en ligne"
                    disabled={busyId === r.id}
                    onPress={() => run(r.id, "keepListingOnlineAction", [r.listing.id])}
                  />
                  <ActionButton
                    label="Mettre en revue"
                    disabled={busyId === r.id}
                    onPress={() => {
                      setReason("");
                      setPrompt({ item: r, action: "reviewListingAction", title: "Mettre en revue" });
                    }}
                  />
                  <ActionButton
                    label="Retirer"
                    tone="danger"
                    disabled={busyId === r.id}
                    onPress={() => {
                      setReason("");
                      setPrompt({ item: r, action: "removeListingAction", title: "Retirer l'annonce" });
                    }}
                  />
                </View>
              )}
            </View>
          ))}

        {(tab === "retirees" || tab === "refusees") &&
          items.map((l: Item) => (
            <View key={l.id} className="bg-surface rounded-xl p-4 mb-2">
              <Pressable onPress={() => router.push(`/annonce/${l.id}`)}>
                <Text className="text-on-surface font-bold text-sm" numberOfLines={2}>
                  {l.title}
                </Text>
              </Pressable>
              <Text className="text-on-surface-variant text-xs mt-0.5">
                {l.user?.name} · {l.price?.toLocaleString("fr-FR")} €
              </Text>
              {l.rejectionReason && (
                <Text className="text-on-surface-variant text-xs mt-1 italic">{l.rejectionReason}</Text>
              )}
              {l.permanentDeletionAt && (
                <Text className="text-on-surface-variant text-[11px] mt-1">
                  Suppression définitive le{" "}
                  {new Date(l.permanentDeletionAt).toLocaleDateString("fr-FR")}
                </Text>
              )}
              <View className="flex-row mt-3">
                <ActionButton
                  label="Remettre en ligne"
                  tone="primary"
                  disabled={busyId === l.id}
                  onPress={() => run(l.id, "restoreListingAction", [l.id])}
                />
                <ActionButton
                  label="Purger"
                  tone="danger"
                  disabled={busyId === l.id}
                  onPress={() =>
                    Alert.alert(
                      "Suppression définitive",
                      "L'annonce, ses photos et son historique partent pour de bon. Irréversible.",
                      [
                        { text: "Annuler", style: "cancel" },
                        {
                          text: "Purger",
                          style: "destructive",
                          // Le site demande de retaper « SUPPRIMER » : même
                          // mot de passe de sécurité ici, via la confirmation.
                          onPress: () => run(l.id, "purgeListingAction", [l.id, "SUPPRIMER"]),
                        },
                      ],
                    )
                  }
                />
              </View>
            </View>
          ))}

        {tab === "surveillance" &&
          items.map((u: Item) => (
            <View key={u.id} className="bg-surface rounded-xl p-4 mb-2">
              <Text className="text-on-surface font-bold text-sm">{u.name}</Text>
              <Text className="text-on-surface-variant text-xs">{u.email}</Text>
              {u.adminNote && (
                <Text className="text-on-surface-variant text-xs mt-1 italic">{u.adminNote}</Text>
              )}
              <View className="flex-row mt-3">
                <ActionButton
                  label="Lever la surveillance"
                  disabled={busyId === u.id}
                  onPress={() => run(u.id, "unwatchAccountAction", [u.id])}
                />
                <ActionButton
                  label="Bannir"
                  tone="danger"
                  disabled={busyId === u.id}
                  onPress={() => {
                    setReason("");
                    setPrompt({ item: u, action: "banAccountAction", title: "Bannir le compte" });
                  }}
                />
              </View>
            </View>
          ))}

        {tab === "bannis" &&
          items.map((u: Item) => (
            <View key={u.id} className="bg-surface rounded-xl p-4 mb-2">
              <Text className="text-on-surface font-bold text-sm">{u.name}</Text>
              <Text className="text-on-surface-variant text-xs">{u.email}</Text>
              <Text className="text-xs mt-1" style={{ color: colors.danger }}>
                Banni le {new Date(u.bannedAt).toLocaleDateString("fr-FR")} —{" "}
                {u.banReason ?? "sans motif"}
              </Text>
              <View className="flex-row mt-3">
                <ActionButton
                  label="Lever le bannissement"
                  tone="primary"
                  disabled={busyId === u.id}
                  onPress={() => run(u.id, "unbanAccountAction", [u.id])}
                />
              </View>
            </View>
          ))}

        {tab === "historique" &&
          items.map((e: Item) => (
            <View key={e.id} className="bg-surface rounded-xl px-4 py-3 mb-2">
              <Text className="text-on-surface text-sm font-semibold">{e.action}</Text>
              <Text className="text-on-surface-variant text-xs mt-0.5">{e.reason}</Text>
              <Text className="text-on-surface-variant text-[11px] mt-1">
                {e.actor} · {new Date(e.createdAt).toLocaleString("fr-FR")}
              </Text>
            </View>
          ))}
      </ScrollView>

      <Modal visible={prompt !== null} transparent animationType="slide" onRequestClose={() => setPrompt(null)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.35)" }}>
          <View className="bg-surface rounded-t-2xl p-5">
            <Text className="text-on-surface font-bold text-base">{prompt?.title}</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Motif"
              placeholderTextColor={colors.outline}
              multiline
              className="mt-3 rounded-xl px-3 py-3 text-on-surface"
              style={{ backgroundColor: colors.surfaceContainer, minHeight: 90 }}
            />
            <View className="flex-row mt-4">
              <ActionButton label="Annuler" onPress={() => setPrompt(null)} />
              <ActionButton
                label="Confirmer"
                tone="danger"
                onPress={() => {
                  const motif = reason.trim();
                  if (motif.length < 3) {
                    Alert.alert("Motif requis", "Expliquez en une phrase.");
                    return;
                  }
                  const target = prompt;
                  setPrompt(null);
                  if (!target) return;
                  const targetId =
                    target.action === "banAccountAction" ? target.item.id : target.item.listing.id;
                  void run(target.item.id, target.action, [targetId, motif]);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

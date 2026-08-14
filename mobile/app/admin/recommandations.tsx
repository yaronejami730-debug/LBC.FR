import { useCallback, useState } from "react";
import { View, Text, Pressable, Alert, ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";
import { adminAction, adminData } from "@/lib/adminApi";
import { ActionButton, StatCard } from "@/components/admin/AdminScreen";
import { colors } from "@/lib/theme";

type Payload = {
  categories: { id: string; label: string }[];
  stats: { profiles: number; withZones: number };
};

type Simulation = {
  categoryLabel: string;
  listingCount: number;
  candidateUsers: number;
  targetedUsers: number;
  exclusions: Record<string, number>;
};

/**
 * Recommandations — simulation d'une campagne par catégorie.
 *
 * La simulation est la seule opération offerte par le site, et pour une bonne
 * raison : elle dit qui serait touché *sans* envoyer. L'envoi réel reste une
 * tâche planifiée, pas un bouton.
 */
export default function AdminRecommandations() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<Simulation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      setData(await adminData<Payload>("recommandations"));
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

  async function simulate(categoryId: string) {
    setBusy(true);
    setSelected(categoryId);
    try {
      setSimulation(await adminAction<Simulation>("simulateCampaign", categoryId));
    } catch (e) {
      Alert.alert("Simulation impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setBusy(true);
    try {
      const res = await adminAction<{ processed: number; withZones: number }>("refreshProfilesNow", 200);
      Alert.alert("Profils recalculés", `${res.processed} comptes traités, ${res.withZones} avec zone.`);
      await load();
    } catch (e) {
      Alert.alert("Recalcul impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-app" contentContainerStyle={{ padding: 16 }}>
      {error && (
        <View className="bg-surface rounded-xl px-4 py-3 mb-3">
          <Text className="text-danger text-sm">{error}</Text>
        </View>
      )}

      <View className="flex-row flex-wrap -mx-1 mb-2">
        <StatCard label="Profils d'intérêt" value={data?.stats.profiles ?? 0} />
        <StatCard label="Profils localisés" value={data?.stats.withZones ?? 0} />
      </View>

      <View className="flex-row mb-3">
        <ActionButton
          label={busy ? "En cours…" : "Recalculer les profils"}
          disabled={busy}
          onPress={refresh}
        />
      </View>

      <Text className="text-on-surface font-bold mb-2">Simuler une campagne</Text>
      <View className="bg-surface rounded-xl overflow-hidden mb-3">
        {(data?.categories ?? []).map((c, i, arr) => (
          <Pressable
            key={c.id}
            onPress={() => simulate(c.id)}
            disabled={busy}
            className="flex-row items-center px-4 py-3 active:opacity-70"
            style={i < arr.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.line } : undefined}
          >
            <Text className="text-on-surface flex-1">{c.label}</Text>
            {selected === c.id && busy ? (
              <Text className="text-on-surface-variant text-xs">…</Text>
            ) : (
              <Text className="text-primary text-xs font-bold">Simuler</Text>
            )}
          </Pressable>
        ))}
      </View>

      {simulation && (
        <View className="bg-surface rounded-xl p-4">
          <Text className="text-on-surface font-bold">{simulation.categoryLabel}</Text>
          <Text className="text-on-surface-variant text-xs mt-1">
            {simulation.listingCount} annonces · {simulation.candidateUsers} candidats ·{" "}
            {simulation.targetedUsers} seraient touchés
          </Text>
          {Object.entries(simulation.exclusions ?? {}).length > 0 && (
            <>
              <Text className="text-on-surface-variant text-[11px] mt-2 font-bold uppercase tracking-wider">
                Exclusions
              </Text>
              {Object.entries(simulation.exclusions).map(([reason, count]) => (
                <Text key={reason} className="text-on-surface-variant text-xs mt-0.5">
                  {reason} : {count}
                </Text>
              ))}
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

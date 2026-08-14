import { useCallback, useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { adminAction, adminData } from "@/lib/adminApi";
import { AdminScreen } from "@/components/admin/AdminScreen";
import { colors } from "@/lib/theme";

type Row = { categoryId: string; label: string; approvalMode: "AUTO" | "MANUAL" };

/**
 * Approbation par catégorie — le même interrupteur que sur le site.
 *
 * « Auto » publie immédiatement, « Manuel » envoie l'annonce en file d'attente.
 * Le réglage est le nerf de la modération : basculer une catégorie en manuel un
 * soir de vague de spam doit se faire depuis n'importe où.
 */
export default function AdminCategories() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const data = await adminData<{ categories: Row[] }>("categories");
      setRows(data.categories);
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

  async function toggle(row: Row) {
    const next = row.approvalMode === "AUTO" ? "MANUAL" : "AUTO";
    setBusy(row.categoryId);
    // Bascule optimiste : le geste doit répondre tout de suite, on revient en
    // arrière si le serveur refuse.
    setRows((prev) =>
      prev.map((r) => (r.categoryId === row.categoryId ? { ...r, approvalMode: next } : r)),
    );
    try {
      await adminAction("updateCategoryApproval", row.categoryId, next);
    } catch (e) {
      setRows((prev) =>
        prev.map((r) => (r.categoryId === row.categoryId ? { ...r, approvalMode: row.approvalMode } : r)),
      );
      Alert.alert("Modification impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminScreen
      title="Approbation par catégorie"
      subtitle="Auto — publiée immédiatement. Manuel — en attente de validation."
      loading={loading && rows.length === 0}
      error={error}
      onRefresh={load}
    >
      <View className="bg-surface rounded-xl overflow-hidden">
        {rows.map((row, i) => {
          const auto = row.approvalMode === "AUTO";
          return (
            <Pressable
              key={row.categoryId}
              onPress={() => toggle(row)}
              disabled={busy === row.categoryId}
              className="flex-row items-center px-4 py-3.5 active:opacity-70"
              style={i < rows.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.line } : undefined}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: auto ? colors.success : "#E0A030",
                }}
              />
              <Text className="text-on-surface flex-1 ml-3 font-medium">{row.label}</Text>
              <View
                className="px-2.5 py-1 rounded-full"
                style={{ backgroundColor: auto ? colors.primaryLight : colors.surfaceContainer }}
              >
                <Text
                  className="text-[11px] font-bold"
                  style={{ color: auto ? colors.primary : colors.onSurfaceVariant }}
                >
                  {auto ? "AUTO" : "MANUEL"}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </AdminScreen>
  );
}

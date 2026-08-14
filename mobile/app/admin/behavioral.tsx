import { useCallback, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useFocusEffect } from "expo-router";
import { adminData } from "@/lib/adminApi";
import { AdminScreen, StatCard } from "@/components/admin/AdminScreen";
import { colors } from "@/lib/theme";

type Payload = {
  stats: { drafts: number; draftsWithContent: number; postVisitors7d: number; events24h: number };
};

/** Une ligne du lot de décisions, telle que la calcule le moteur. */
type Row = {
  userId: string;
  email: string;
  name: string;
  envoyer: boolean;
  reason: string;
  decisionReason: string;
  intent: number;
  friction: number;
  proba: number;
  canal: string;
  action: string;
  heure: string;
  hot: boolean;
};

/**
 * Moteur comportemental — les volumes, puis le lot de décisions.
 *
 * Comme sur le site : qui recevrait quoi, par quel canal, à quelle heure, et
 * pour ceux qu'on ne contacte pas, la raison exacte du renoncement. Lecture
 * seule — le moteur décide, cet écran l'explique.
 */
export default function AdminBehavioral() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [showRows, setShowRows] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      setData(await adminData<Payload>("behavioral"));
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

  /**
   * Le lot complet est calculé à la demande : il fait tourner le moteur de
   * décision sur cinquante comptes, ce qui prend plusieurs secondes. L'ouvrir
   * automatiquement rendrait l'écran lent pour rien.
   */
  const loadRows = useCallback(async () => {
    setRowsLoading(true);
    try {
      const data = await adminData<{ rows: Row[] }>("behavioral-batch");
      setRows(data.rows);
      setShowRows(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Calcul impossible");
    } finally {
      setRowsLoading(false);
    }
  }, []);

  const s = data?.stats;

  return (
    <AdminScreen
      title="Moteur comportemental"
      subtitle="Brouillons en cours, intentions de publication et volume d'événements."
      loading={loading && !data}
      error={error}
      onRefresh={load}
    >
      <View className="flex-row flex-wrap -mx-1">
        <StatCard label="Brouillons" value={s?.drafts ?? 0} hint="Tous états confondus" />
        <StatCard
          label="Brouillons entamés"
          value={s?.draftsWithContent ?? 0}
          hint="Au moins un champ rempli"
        />
        <StatCard
          label="Visiteurs de /post (7 j)"
          value={s?.postVisitors7d ?? 0}
          hint="Comptes ayant ouvert la publication"
        />
        <StatCard label="Événements (24 h)" value={s?.events24h ?? 0} hint="Journal comportemental" />
      </View>

      {!showRows ? (
        <Pressable
          onPress={loadRows}
          disabled={rowsLoading}
          className="rounded-xl items-center py-3 mt-2 active:opacity-70"
          style={{ backgroundColor: colors.primary, opacity: rowsLoading ? 0.5 : 1 }}
        >
          <Text className="text-white font-bold">
            {rowsLoading ? "Calcul du lot…" : "Voir les décisions candidat par candidat"}
          </Text>
        </Pressable>
      ) : (
        <View className="mt-2">
          <Text className="text-on-surface font-bold mb-2">
            {rows.length} candidats · {rows.filter((r) => r.envoyer).length} à contacter
          </Text>
          {rows.map((row) => (
            <View key={row.userId} className="bg-surface rounded-xl p-4 mb-2">
              <View className="flex-row items-center">
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: row.envoyer ? colors.success : colors.outline,
                  }}
                />
                <Text className="text-on-surface font-bold text-sm ml-2 flex-1" numberOfLines={1}>
                  {row.name || row.email}
                </Text>
                {row.hot && (
                  <Text className="text-[10px] font-bold" style={{ color: colors.danger }}>
                    MOMENT CHAUD
                  </Text>
                )}
              </View>
              <Text className="text-on-surface-variant text-xs mt-0.5" numberOfLines={1}>
                {row.email}
              </Text>
              <Text className="text-on-surface-variant text-xs mt-1">
                Intention {row.intent} · friction {row.friction} · proba{" "}
                {Math.round(row.proba * 100)} %
              </Text>
              <Text className="text-on-surface-variant text-xs mt-0.5">
                {row.envoyer
                  ? `${row.canal} · ${row.action} · ${row.heure}`
                  : `Pas d'envoi — ${row.decisionReason}`}
              </Text>
              <Text className="text-on-surface-variant text-[11px] mt-0.5">Raison : {row.reason}</Text>
            </View>
          ))}
        </View>
      )}
    </AdminScreen>
  );
}

import { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useFocusEffect } from "expo-router";
import { adminData } from "@/lib/adminApi";
import { AdminScreen, StatCard } from "@/components/admin/AdminScreen";
import { colors } from "@/lib/theme";

type Payload = {
  total: number;
  indexable: number;
  inSitemap: number;
  discovered24h: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
};

/** Mêmes libellés que le site : un code de statut ne se lit pas. */
const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente d'analyse",
  ELIGIBLE: "Éligible — recommandée à Google",
  EXCLUDED: "Exclue par nos règles",
  SUBMITTED: "Envoyée à IndexNow",
  DISCOVERED: "Découverte, pas explorée",
  CRAWLED: "Explorée, pas indexée",
  INDEXED: "Indexée par Google",
  NOT_INDEXED: "Écartée par Google",
  ERROR: "Erreur de traitement",
  GONE: "Retirée du site",
};

const TYPE_LABELS: Record<string, string> = {
  LISTING: "Annonces",
  CATEGORY: "Catégories",
  SUBCATEGORY: "Sous-catégories",
  CITY: "Villes",
  CATEGORY_CITY: "Catégorie × ville",
  BRAND: "Marques / modèles",
  PRO: "Fiches pro",
  EDITORIAL: "Éditorial",
  BLOG: "Blog",
  STATIC: "Pages fixes",
};

/**
 * Indexation SEO — notre verdict et celui de Google, séparés.
 *
 * Le principe de l'écran du site est conservé : rien n'est déduit, chaque
 * chiffre correspond à une ligne en base. Confondre « ce que nous recommandons »
 * et « ce que Google indexe » est ce qui rendait l'ancien écran inutile.
 */
export default function AdminSeo() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      setData(await adminData<Payload>("seo"));
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

  return (
    <AdminScreen
      title="Indexation SEO"
      subtitle="Notre verdict (éligible, exclue) et celui de Google (indexée, écartée) ne se mélangent pas."
      loading={loading && !data}
      error={error}
      onRefresh={load}
    >
      <View className="flex-row flex-wrap -mx-1 mb-2">
        <StatCard label="URLs connues" value={data?.total ?? 0} />
        <StatCard label="Indexables" value={data?.indexable ?? 0} hint="Notre verdict" />
        <StatCard label="Dans le sitemap" value={data?.inSitemap ?? 0} />
        <StatCard label="Découvertes (24 h)" value={data?.discovered24h ?? 0} />
      </View>

      <Section title="Par statut" rows={data?.byStatus} labels={STATUS_LABELS} />
      <Section title="Par type de page" rows={data?.byType} labels={TYPE_LABELS} />
    </AdminScreen>
  );
}

function Section({
  title,
  rows,
  labels,
}: {
  title: string;
  rows?: Record<string, number>;
  labels: Record<string, string>;
}) {
  const entries = Object.entries(rows ?? {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  return (
    <View className="bg-surface rounded-xl p-4 mb-2">
      <Text className="text-on-surface font-bold mb-2">{title}</Text>
      {entries.map(([key, value], i) => (
        <View
          key={key}
          className="flex-row items-center py-2"
          style={i < entries.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.line } : undefined}
        >
          <Text className="text-on-surface text-sm flex-1">{labels[key] ?? key}</Text>
          <Text className="text-on-surface font-bold text-sm">{value}</Text>
        </View>
      ))}
    </View>
  );
}

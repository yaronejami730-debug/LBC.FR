import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { adminData, ADMIN_SECTIONS } from "@/lib/adminApi";
import { useAdminMode } from "@/lib/adminMode";
import { colors } from "@/lib/theme";

type Dashboard = {
  stats: {
    totalUsers: number;
    proUsers: number;
    particuliers: number;
    pendingListings: number;
    activeListings: number;
    approvedListings: number;
    rejectedListings: number;
    totalAds: number;
    pendingProAccounts: number;
    visits30d: number;
    openSupport: number;
  };
  recentPending: {
    id: string;
    title: string;
    price: number;
    createdAt: string;
    user: { name: string } | null;
  }[];
};

/**
 * Tableau de bord de l'administration mobile.
 *
 * Reprend les pavés du site, dans le même ordre, avec les mêmes chiffres — et
 * la barre latérale devient une liste, seule adaptation qu'impose un écran de
 * téléphone. Chaque pavé mène à l'écran qui permet d'agir dessus : un compteur
 * qui ne se clique pas oblige à retrouver la page à la main.
 */
export default function AdminHome() {
  const router = useRouter();
  const { setAdminMode } = useAdminMode();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await adminData<Dashboard>("dashboard"));
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

  if (loading && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-app">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const s = data?.stats;

  const cards = [
    { label: "Comptes particuliers", value: s?.particuliers ?? 0, href: "/admin/users" },
    { label: "Comptes professionnels", value: s?.proUsers ?? 0, href: "/admin/professionnels" },
    {
      label: "Annonces en attente",
      value: s?.pendingListings ?? 0,
      href: "/admin/annonces",
      urgent: (s?.pendingListings ?? 0) > 0,
    },
    { label: "Annonces actives", value: s?.activeListings ?? 0, href: "/admin/annonces" },
    {
      label: "Support en attente",
      value: s?.openSupport ?? 0,
      href: "/admin/support",
      urgent: (s?.openSupport ?? 0) > 0,
    },
    { label: "Visites (30 j)", value: s?.visits30d ?? 0, href: "/admin/behavioral" },
    {
      label: "En attente de vérification",
      value: s?.pendingProAccounts ?? 0,
      href: "/admin/professionnels",
      urgent: (s?.pendingProAccounts ?? 0) > 0,
    },
    { label: "Publicités actives", value: s?.totalAds ?? 0, href: "/admin/ads" },
    { label: "Annonces refusées", value: s?.rejectedListings ?? 0, href: "/admin/securite" },
  ] as const;

  return (
    <ScrollView
      className="flex-1 bg-app"
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
      }
    >
      {error && (
        <View className="bg-surface rounded-xl px-4 py-3 mb-3">
          <Text className="text-danger text-sm">{error}</Text>
        </View>
      )}

      <View className="flex-row flex-wrap -mx-1 mb-3">
        {cards.map((c) => (
          <View key={c.label} className="w-1/2 px-1 mb-2">
            <Pressable
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onPress={() => router.push(c.href as any)}
              className="bg-surface rounded-xl p-4 active:opacity-70"
              style={"urgent" in c && c.urgent ? { borderWidth: 1, borderColor: colors.danger } : undefined}
            >
              <Text className="text-2xl font-extrabold" style={{ color: "urgent" in c && c.urgent ? colors.danger : colors.onSurface }}>
                {c.value}
              </Text>
              <Text className="text-on-surface-variant text-xs mt-0.5">{c.label}</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {(data?.recentPending.length ?? 0) > 0 && (
        <View className="bg-surface rounded-xl p-4 mb-3">
          <Text className="text-on-surface font-bold mb-2">Dernières annonces en attente</Text>
          {data?.recentPending.map((l) => (
            <Pressable
              key={l.id}
              onPress={() => router.push(`/annonce/${l.id}`)}
              className="py-2 active:opacity-70"
            >
              <Text className="text-on-surface text-sm" numberOfLines={1}>
                {l.title}
              </Text>
              <Text className="text-on-surface-variant text-xs">
                {l.price.toLocaleString("fr-FR")} € · {l.user?.name ?? "compte supprimé"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* La barre latérale du site, en liste. Mêmes entrées, même ordre. */}
      <Text className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-2 px-1">
        Gestion
      </Text>
      <View className="bg-surface rounded-xl overflow-hidden mb-3">
        {ADMIN_SECTIONS.filter((s) => !s.exact).map((section, i, arr) => (
          <Pressable
            key={section.href}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onPress={() => router.push(section.href as any)}
            className="flex-row items-center px-4 py-3.5 active:opacity-70"
            style={i < arr.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.line } : undefined}
          >
            <Ionicons name={section.icon} size={20} color={colors.primary} />
            <Text className="text-on-surface flex-1 ml-3 font-medium">{section.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.outline} />
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={async () => {
          await setAdminMode(false);
          router.replace("/(tabs)/profile");
        }}
        className="flex-row items-center justify-center bg-surface rounded-xl px-4 py-3.5 active:opacity-70"
      >
        <Ionicons name="swap-horizontal-outline" size={18} color={colors.primary} />
        <Text className="text-primary font-semibold ml-2">Revenir en mode utilisateur</Text>
      </Pressable>
    </ScrollView>
  );
}

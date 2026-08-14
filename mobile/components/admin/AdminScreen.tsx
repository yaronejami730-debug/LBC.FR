import type { ReactNode } from "react";
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/theme";

/**
 * Coquille commune des écrans d'administration.
 *
 * Les quatorze sections partagent le même squelette : un titre, une phrase
 * d'explication, un état de chargement, un message d'erreur lisible, un
 * tirer-pour-rafraîchir. L'écrire une fois évite quatorze variantes qui
 * finissent par ne plus se ressembler.
 */
export function AdminScreen({
  title,
  subtitle,
  loading,
  error,
  onRefresh,
  children,
  scroll = true,
}: {
  title?: string;
  subtitle?: string;
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
  children: ReactNode;
  scroll?: boolean;
}) {
  const header = (
    <>
      {(title || subtitle) && (
        <View className="mb-3">
          {title && <Text className="text-on-surface text-xl font-extrabold">{title}</Text>}
          {subtitle && (
            <Text className="text-on-surface-variant text-xs mt-1 leading-5">{subtitle}</Text>
          )}
        </View>
      )}
      {error && (
        <View className="bg-surface rounded-xl px-4 py-3 mb-3">
          <Text className="text-danger text-sm">{error}</Text>
        </View>
      )}
    </>
  );

  if (loading && !error) {
    return (
      <View className="flex-1 bg-app items-center justify-center">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!scroll) {
    return (
      <View className="flex-1 bg-app px-4 pt-4">
        {header}
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-app"
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {header}
      {children}
    </ScrollView>
  );
}

/** Carte de statistique — l'équivalent des pavés du tableau de bord du site. */
export function StatCard({
  label,
  value,
  hint,
  urgent,
  onPress,
}: {
  label: string;
  value: string | number;
  hint?: string;
  urgent?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <View
      className="bg-surface rounded-xl p-4"
      style={urgent ? { borderWidth: 1, borderColor: colors.danger } : undefined}
    >
      <Text className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
        {label}
      </Text>
      <Text
        className="text-2xl font-extrabold mt-1"
        style={{ color: urgent ? colors.danger : colors.onSurface }}
      >
        {value}
      </Text>
      {hint && <Text className="text-on-surface-variant text-xs mt-0.5">{hint}</Text>}
    </View>
  );

  return (
    <View className="w-1/2 px-1 mb-2">
      {onPress ? (
        <Pressable onPress={onPress} className="active:opacity-70">
          {body}
        </Pressable>
      ) : (
        body
      )}
    </View>
  );
}

/** Bandeau d'onglets — même rôle que les filtres en haut des pages du site. */
export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
      {tabs.map((t) => (
        <Pressable
          key={t.value}
          onPress={() => onChange(t.value)}
          className="mr-2 px-3 py-1.5 rounded-full"
          style={{ backgroundColor: value === t.value ? colors.primary : colors.surface }}
        >
          <Text
            className="text-xs font-bold"
            style={{ color: value === t.value ? "#fff" : colors.onSurfaceVariant }}
          >
            {t.label}
            {t.count !== undefined ? ` (${t.count})` : ""}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Ligne d'action compacte, réutilisée par les listes de toutes les sections. */
export function ActionButton({
  label,
  onPress,
  tone = "neutral",
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "danger" | "neutral";
  disabled?: boolean;
}) {
  const background =
    tone === "primary" ? colors.primary : tone === "danger" ? colors.danger : colors.surfaceContainer;
  const color = tone === "neutral" ? colors.onSurfaceVariant : "#fff";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="flex-1 items-center py-2.5 rounded-xl mr-2"
      style={{ backgroundColor: background, opacity: disabled ? 0.5 : 1 }}
    >
      <Text className="font-bold text-xs" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Message d'une liste vide — jamais un écran blanc sans explication. */
export function Empty({ label }: { label: string }) {
  return (
    <View className="items-center mt-10">
      <Ionicons name="checkmark-done-outline" size={28} color={colors.outline} />
      <Text className="text-on-surface-variant text-center mt-2">{label}</Text>
    </View>
  );
}

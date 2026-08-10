import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

export type Segment<T extends string = string> = {
  value: T;
  label: string;
  /** Pastille numérique optionnelle (ex. nombre de favoris). */
  count?: number;
};

type Props<T extends string> = {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * Pilule pleine largeur — piste grise, onglet actif en bleu marine plein.
 * Ex. "Toutes / Récentes / Favoris", "Actives / Vendues".
 */
export default function SegmentedControl<T extends string>({ segments, value, onChange }: Props<T>) {
  return (
    <View className="flex-row bg-surface-container rounded-full p-1">
      {segments.map((s) => {
        const active = s.value === value;
        return (
          <Pressable
            key={s.value}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync().catch(() => {});
              onChange(s.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={`flex-1 flex-row items-center justify-center rounded-full py-2.5 px-3 ${
              active ? "bg-navy" : "bg-transparent"
            }`}
          >
            <Text
              numberOfLines={1}
              className={`text-[13px] font-bold ${active ? "text-white" : "text-on-surface"}`}
            >
              {s.label}
            </Text>
            {typeof s.count === "number" && s.count > 0 && (
              <View className={`ml-1.5 px-1.5 rounded-full ${active ? "bg-white/20" : "bg-primary-light"}`}>
                <Text className={`text-[11px] font-bold ${active ? "text-white" : "text-primary"}`}>
                  {s.count > 99 ? "99+" : s.count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

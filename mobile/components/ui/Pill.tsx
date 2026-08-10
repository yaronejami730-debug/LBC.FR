import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/theme";

type PillProps = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Affiche un bouton rond bleu à droite (ex. "+" pour créer une alerte). */
  action?: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; accessibilityLabel: string };
  onPress?: () => void;
};

/** Pill d'info du haut d'écran : fond blanc, bordure fine, coins pleins. */
export function Pill({ label, icon, action, onPress }: PillProps) {
  const body = (
    <View className="flex-row items-center bg-surface border border-line rounded-full pl-3 pr-1 py-1">
      {icon && <Ionicons name={icon} size={15} color={colors.onSurfaceVariant} style={{ marginRight: 6 }} />}
      <Text className="text-on-surface text-[13px] font-bold">{label}</Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel}
          className="ml-2 w-7 h-7 rounded-full bg-primary items-center justify-center active:opacity-80"
        >
          <Ionicons name={action.icon} size={16} color={colors.white} />
        </Pressable>
      ) : (
        <View className="w-1" />
      )}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} className="active:opacity-70">
      {body}
    </Pressable>
  );
}

type TagProps = {
  label: string;
  /** Variante pleine bleue pour un état actif. */
  active?: boolean;
  onPress?: () => void;
};

/** Tag / filtre : bleu pâle au repos, bleu primaire plein une fois actif. */
export function Tag({ label, active = false, onPress }: TagProps) {
  const content = (
    <View className={`rounded-full px-3.5 py-2 ${active ? "bg-primary" : "bg-primary-light"}`}>
      <Text className={`text-[13px] font-semibold ${active ? "text-white" : "text-primary"}`}>{label}</Text>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} className="active:opacity-70">
      {content}
    </Pressable>
  );
}

export default Pill;

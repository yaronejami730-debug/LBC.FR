import { View, Text, Pressable, ScrollView, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const SITE = "https://www.dealandcompany.fr";

export default function Aide() {
  return (
    <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ padding: 16 }}>
      <LinkRow
        icon="help-circle-outline"
        label="Centre d'aide / FAQ"
        onPress={() => Linking.openURL(`${SITE}/aide`)}
      />
      <LinkRow
        icon="mail-outline"
        label="Contacter le support"
        onPress={() => Linking.openURL("mailto:support@dealandcompany.fr")}
      />
      <LinkRow
        icon="document-text-outline"
        label="Conditions générales"
        onPress={() => Linking.openURL(`${SITE}/cgu`)}
      />
      <LinkRow
        icon="lock-closed-outline"
        label="Politique de confidentialité"
        onPress={() => Linking.openURL(`${SITE}/confidentialite`)}
      />

      <Text className="text-on-surface-variant text-xs text-center mt-6">Deal&Co · v1.0.0</Text>
    </ScrollView>
  );
}

function LinkRow({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center bg-surface-container-low rounded-xl px-4 py-3.5 mb-2 active:opacity-70">
      <Ionicons name={icon} size={20} color="#2f6fb8" />
      <Text className="text-on-surface flex-1 ml-3 font-medium">{label}</Text>
      <Ionicons name="open-outline" size={18} color="#94a3b8" />
    </Pressable>
  );
}

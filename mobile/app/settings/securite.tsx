import { View, Text, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";

export default function Securite() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ padding: 16 }}>
      <View className="bg-surface-container-low rounded-xl p-4 mb-4">
        <View className="flex-row items-center">
          <Ionicons
            name={user?.emailVerified ? "shield-checkmark" : "shield-outline"}
            size={22}
            color={user?.emailVerified ? "#16a34a" : "#d97706"}
          />
          <Text className="text-on-surface font-semibold ml-2">
            {user?.emailVerified ? "Compte vérifié" : "Email non vérifié"}
          </Text>
        </View>
        <Text className="text-on-surface-variant text-xs mt-2">
          {user?.emailVerified
            ? "Votre adresse email est confirmée."
            : "Vérifiez votre email pour sécuriser votre compte."}
        </Text>
      </View>

      <NavRow icon="key-outline" label="Mot de passe" onPress={() => router.push("/settings/mot-de-passe")} />
      <NavRow icon="phone-portrait-outline" label="Appareils connectés" onPress={() => router.push("/settings/appareils")} />
    </ScrollView>
  );
}

function NavRow({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center bg-surface-container-low rounded-xl px-4 py-3.5 mb-2 active:opacity-70">
      <Ionicons name={icon} size={20} color="#2f6fb8" />
      <Text className="text-on-surface flex-1 ml-3 font-medium">{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
    </Pressable>
  );
}

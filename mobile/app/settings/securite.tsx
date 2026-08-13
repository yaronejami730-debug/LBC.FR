import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useAdminMode } from "@/lib/adminMode";
import { colors } from "@/lib/theme";

export default function Securite() {
  const router = useRouter();
  const { user } = useAuth();
  const { adminMode, canSwitch, setAdminMode } = useAdminMode();

  /**
   * Bascule utilisateur ↔ administrateur.
   *
   * La confirmation n'est pas une précaution de sécurité — le rôle est vérifié
   * à chaque appel serveur — mais une précaution d'usage : le mode change les
   * notifications reçues, et un administrateur qui bascule sans le savoir
   * cesserait de voir passer ses propres messages.
   */
  async function toggleMode() {
    const next = !adminMode;
    Alert.alert(
      next ? "Passer en mode administrateur" : "Revenir en mode utilisateur",
      next
        ? "Vous verrez les files de modération et recevrez les alertes d'administration à la place de vos notifications habituelles."
        : "Vous retrouvez l'application normale et vos notifications personnelles.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: next ? "Passer en admin" : "Revenir",
          onPress: async () => {
            await setAdminMode(next);
            if (next) router.replace("/admin");
          },
        },
      ],
    );
  }

  return (
    <ScrollView className="flex-1 bg-app" contentContainerStyle={{ padding: 16 }}>
      <View className="bg-surface rounded-xl p-4 mb-4">
        <View className="flex-row items-center">
          <Ionicons
            name={user?.emailVerified ? "shield-checkmark" : "shield-outline"}
            size={22}
            color={user?.emailVerified ? colors.success : colors.danger}
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

      {canSwitch && (
        <>
          <Pressable
            onPress={toggleMode}
            className="flex-row items-center bg-surface rounded-xl px-4 py-3.5 mb-2 active:opacity-70"
          >
            <Ionicons name="swap-horizontal-outline" size={20} color={colors.primary} />
            <View className="flex-1 ml-3">
              <Text className="text-on-surface font-medium">Changer de mode</Text>
              <Text className="text-on-surface-variant text-xs mt-0.5">
                {adminMode ? "Mode administrateur actif" : "Mode utilisateur"}
              </Text>
            </View>
            <View
              className="px-2.5 py-1 rounded-full"
              style={{ backgroundColor: adminMode ? colors.primary : colors.surfaceContainer }}
            >
              <Text
                className="text-[11px] font-bold"
                style={{ color: adminMode ? "#fff" : colors.onSurfaceVariant }}
              >
                {adminMode ? "ADMIN" : "USER"}
              </Text>
            </View>
          </Pressable>

          {adminMode && (
            <NavRow
              icon="speedometer-outline"
              label="Ouvrir l'administration"
              onPress={() => router.push("/admin")}
            />
          )}
        </>
      )}
    </ScrollView>
  );
}

function NavRow({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center bg-surface rounded-xl px-4 py-3.5 mb-2 active:opacity-70">
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text className="text-on-surface flex-1 ml-3 font-medium">{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.outline} />
    </Pressable>
  );
}

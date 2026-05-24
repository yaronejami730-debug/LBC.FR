import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";

export default function EmailScreen() {
  const { user } = useAuth();

  return (
    <View className="flex-1 bg-surface p-4">
      <Text className="text-on-surface-variant text-xs mb-1.5 font-semibold">ADRESSE EMAIL</Text>
      <View className="bg-surface-container rounded-lg px-3 py-3 mb-3 flex-row items-center justify-between">
        <Text className="text-on-surface">{user?.email}</Text>
        {user?.emailVerified ? (
          <View className="flex-row items-center">
            <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
            <Text className="text-green-600 text-xs font-semibold ml-1">Vérifiée</Text>
          </View>
        ) : (
          <Text className="text-amber-600 text-xs font-semibold">Non vérifiée</Text>
        )}
      </View>

      <View className="bg-surface-container-low rounded-xl p-4">
        <Text className="text-on-surface-variant text-sm leading-relaxed">
          Pour changer votre adresse email, contactez le support à{" "}
          <Text className="text-primary font-semibold">support@dealandcompany.fr</Text>. Un changement d'email
          nécessite une nouvelle vérification pour sécuriser votre compte.
        </Text>
      </View>
    </View>
  );
}

import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";

export default function PostScreen() {
  const router = useRouter();
  const { user } = useAuth();

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-on-surface text-xl font-bold mb-2">Publier une annonce</Text>
          <Text className="text-on-surface-variant text-sm mb-6 text-center">Connectez-vous pour publier.</Text>
          <Pressable onPress={() => router.push("/(auth)/login")} className="bg-primary px-6 py-3 rounded-full">
            <Text className="text-white font-bold">Se connecter</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-on-surface text-xl font-bold">Publier une annonce</Text>
        <Text className="text-on-surface-variant text-sm mt-2 text-center">Formulaire à venir.</Text>
      </View>
    </SafeAreaView>
  );
}

import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, loading } = useAuth();

  if (loading) {
    return <SafeAreaView className="flex-1 bg-surface"><View className="flex-1" /></SafeAreaView>;
  }

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-on-surface text-2xl font-extrabold mb-2">Bienvenue sur Deal&Co</Text>
          <Text className="text-on-surface-variant text-sm mb-8 text-center">Connectez-vous pour gérer vos annonces, favoris et messages.</Text>
          <Pressable onPress={() => router.push("/(auth)/login")} className="bg-primary px-8 py-3 rounded-full mb-3 w-full max-w-xs items-center">
            <Text className="text-white font-bold">Se connecter</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/(auth)/register")} className="border border-primary px-8 py-3 rounded-full w-full max-w-xs items-center">
            <Text className="text-primary font-bold">Créer un compte</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="bg-surface-container-low rounded-2xl p-5 mb-4">
          <Text className="text-on-surface text-xl font-bold">{user.companyName || user.name}</Text>
          <Text className="text-on-surface-variant text-sm mt-1">{user.email}</Text>
          {user.isPro && <Text className="text-primary text-xs font-bold mt-2">COMPTE PRO</Text>}
          {!user.emailVerified && (
            <View className="mt-3 bg-amber-100 px-3 py-2 rounded-lg">
              <Text className="text-amber-900 text-xs">Email non vérifié. Vérifiez votre boîte mail.</Text>
            </View>
          )}
        </View>

        <Pressable onPress={logout} className="bg-red-50 border border-red-200 rounded-xl py-3 items-center mt-4">
          <Text className="text-red-600 font-semibold">Se déconnecter</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

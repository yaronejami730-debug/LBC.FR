import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";

export default function HeroBanner() {
  const router = useRouter();
  return (
    <View className="rounded-2xl overflow-hidden mt-2" style={{ backgroundColor: "#2f6fb8" }}>
      <View className="p-5">
        <Text className="text-white text-2xl font-extrabold leading-tight">
          Petites annonces gratuites entre particuliers
        </Text>
        <Text className="text-white/90 text-sm mt-2 leading-relaxed">
          Publiez en 2 minutes. Sans commission, contact direct.
        </Text>
        <View className="flex-row gap-2 mt-4">
          <Pressable
            onPress={() => router.push("/(tabs)/post")}
            className="bg-white px-5 py-2.5 rounded-full active:opacity-80"
          >
            <Text className="text-primary font-bold text-sm">Publier mon annonce</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

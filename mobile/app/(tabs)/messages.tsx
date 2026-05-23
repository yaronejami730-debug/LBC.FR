import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function MessagesScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-on-surface text-xl font-bold">Messages</Text>
        <Text className="text-on-surface-variant text-sm mt-2 text-center">Bientôt disponible.</Text>
      </View>
    </SafeAreaView>
  );
}

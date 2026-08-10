import { Stack } from "expo-router";
import { colors } from "@/lib/theme";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerTitle: "", headerShadowVisible: false, headerStyle: { backgroundColor: colors.white } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}

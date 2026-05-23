import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email || !password) { setError("Email et mot de passe requis"); return; }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["bottom"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 8 }} keyboardShouldPersistTaps="handled">
          <Text className="text-on-surface text-3xl font-extrabold mb-2">Connexion</Text>
          <Text className="text-on-surface-variant text-sm mb-8">Accédez à votre compte Deal&Co.</Text>

          <Text className="text-on-surface text-sm font-semibold mb-2">Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="vous@exemple.com"
            placeholderTextColor="#9ca3af"
            className="border border-surface-container rounded-xl px-4 py-3 text-on-surface mb-4 bg-white"
          />

          <Text className="text-on-surface text-sm font-semibold mb-2">Mot de passe</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            placeholder="••••••••"
            placeholderTextColor="#9ca3af"
            className="border border-surface-container rounded-xl px-4 py-3 text-on-surface mb-2 bg-white"
          />

          <Link href="/(auth)/forgot-password" className="self-end mb-6">
            <Text className="text-primary text-sm font-semibold">Mot de passe oublié ?</Text>
          </Link>

          {error && <Text className="text-red-600 text-sm mb-3">{error}</Text>}

          <Pressable onPress={submit} disabled={loading} className="bg-primary py-3.5 rounded-full items-center active:opacity-80">
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text className="text-white font-bold text-base">Se connecter</Text>}
          </Pressable>

          <View className="flex-row justify-center mt-6">
            <Text className="text-on-surface-variant text-sm">Pas encore de compte ? </Text>
            <Link href="/(auth)/register"><Text className="text-primary text-sm font-bold">Créer un compte</Text></Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

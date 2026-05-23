import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Switch } from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name.trim() || !email.trim() || !password) { setError("Tous les champs sont requis"); return; }
    if (password.length < 8) { setError("Le mot de passe doit contenir au moins 8 caractères"); return; }
    setLoading(true);
    try {
      await register({ name: name.trim(), email: email.trim().toLowerCase(), password, marketingConsent: marketing });
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Inscription impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["bottom"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 8 }} keyboardShouldPersistTaps="handled">
          <Text className="text-on-surface text-3xl font-extrabold mb-2">Créer un compte</Text>
          <Text className="text-on-surface-variant text-sm mb-8">Rejoignez Deal&Co gratuitement.</Text>

          <Text className="text-on-surface text-sm font-semibold mb-2">Nom</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Votre nom"
            placeholderTextColor="#9ca3af"
            className="border border-surface-container rounded-xl px-4 py-3 text-on-surface mb-4 bg-white"
          />

          <Text className="text-on-surface text-sm font-semibold mb-2">Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
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
            placeholder="Au moins 8 caractères"
            placeholderTextColor="#9ca3af"
            className="border border-surface-container rounded-xl px-4 py-3 text-on-surface mb-4 bg-white"
          />

          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-on-surface-variant text-sm flex-1 pr-3">J'accepte de recevoir les actualités Deal&Co</Text>
            <Switch value={marketing} onValueChange={setMarketing} trackColor={{ true: "#2f6fb8" }} />
          </View>

          {error && <Text className="text-red-600 text-sm mb-3">{error}</Text>}

          <Pressable onPress={submit} disabled={loading} className="bg-primary py-3.5 rounded-full items-center active:opacity-80">
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text className="text-white font-bold text-base">Créer mon compte</Text>}
          </Pressable>

          <View className="flex-row justify-center mt-6">
            <Text className="text-on-surface-variant text-sm">Déjà inscrit ? </Text>
            <Link href="/(auth)/login"><Text className="text-primary text-sm font-bold">Se connecter</Text></Link>
          </View>

          <Text className="text-outline text-[11px] text-center mt-6 leading-snug">
            En créant un compte, vous acceptez les CGU et la politique de confidentialité de Deal&Co.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

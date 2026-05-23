import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiFetch } from "@/lib/api";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim()) { setError("Email requis"); return; }
    setLoading(true);
    try {
      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
        auth: false,
      });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["bottom"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 8 }} keyboardShouldPersistTaps="handled">
          <Text className="text-on-surface text-3xl font-extrabold mb-2">Mot de passe oublié</Text>
          <Text className="text-on-surface-variant text-sm mb-8">Saisissez votre email — nous vous enverrons un lien de réinitialisation.</Text>

          {sent ? (
            <View className="bg-green-50 border border-green-200 rounded-xl p-4">
              <Text className="text-green-800 font-semibold">Email envoyé !</Text>
              <Text className="text-green-700 text-sm mt-1">Si un compte existe avec cette adresse, vous recevrez un lien sous peu.</Text>
            </View>
          ) : (
            <>
              <Text className="text-on-surface text-sm font-semibold mb-2">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="vous@exemple.com"
                placeholderTextColor="#9ca3af"
                className="border border-surface-container rounded-xl px-4 py-3 text-on-surface mb-6 bg-white"
              />
              {error && <Text className="text-red-600 text-sm mb-3">{error}</Text>}
              <Pressable onPress={submit} disabled={loading} className="bg-primary py-3.5 rounded-full items-center active:opacity-80">
                {loading ? <ActivityIndicator color="#ffffff" /> : <Text className="text-white font-bold text-base">Envoyer le lien</Text>}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

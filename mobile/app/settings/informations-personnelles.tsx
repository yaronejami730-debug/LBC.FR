import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

export default function InformationsPersonnelles() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [companyName, setCompanyName] = useState(user?.companyName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (name.trim().length < 2) {
      setError("Indiquez votre nom (2 caractères min).");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), companyName: companyName.trim() }),
      });
      await refresh();
      Alert.alert("Enregistré", "Vos informations ont été mises à jour.");
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-surface">
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-on-surface-variant text-xs mb-1.5 font-semibold">NOM COMPLET</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Votre nom"
          placeholderTextColor="#94a3b8"
          className="bg-surface-container rounded-lg px-3 py-3 text-on-surface mb-4"
        />

        {user?.isPro && (
          <>
            <Text className="text-on-surface-variant text-xs mb-1.5 font-semibold">RAISON SOCIALE</Text>
            <TextInput
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="Nom de l'entreprise"
              placeholderTextColor="#94a3b8"
              className="bg-surface-container rounded-lg px-3 py-3 text-on-surface mb-4"
            />
          </>
        )}

        {error && (
          <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        )}

        <Pressable
          onPress={save}
          disabled={saving}
          className={`py-3.5 rounded-full items-center ${saving ? "bg-outline" : "bg-primary"}`}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Enregistrer</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

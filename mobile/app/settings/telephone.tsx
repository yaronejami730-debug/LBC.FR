import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

export default function Telephone() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [phone, setPhone] = useState(user?.phoneNumber ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    setSaving(true);
    try {
      await apiFetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ phoneNumber: phone.trim() }),
      });
      await refresh();
      Alert.alert("Enregistré", phone.trim() ? "Votre numéro a été mis à jour." : "Votre numéro a été supprimé.");
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
        <Text className="text-on-surface-variant text-xs mb-1.5 font-semibold">NUMÉRO DE TÉLÉPHONE</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="06 12 34 56 78"
          keyboardType="phone-pad"
          placeholderTextColor="#94a3b8"
          className="bg-surface-container rounded-lg px-3 py-3 text-on-surface mb-2"
        />
        <Text className="text-on-surface-variant text-xs mb-4">
          Laissez vide pour supprimer votre numéro. Il reste privé sauf si vous l'affichez sur une annonce.
        </Text>

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

import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { apiFetch } from "@/lib/api";

export default function MotDePasse() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (next.length < 8) {
      setError("Le nouveau mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (next !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/account/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      Alert.alert("Mot de passe modifié", "Votre mot de passe a été mis à jour.");
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la modification");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-surface">
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Field label="MOT DE PASSE ACTUEL" value={current} onChangeText={setCurrent} />
        <Field label="NOUVEAU MOT DE PASSE" value={next} onChangeText={setNext} />
        <Field label="CONFIRMER LE NOUVEAU MOT DE PASSE" value={confirm} onChangeText={setConfirm} />

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
          {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Modifier le mot de passe</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText }: { label: string; value: string; onChangeText: (v: string) => void }) {
  return (
    <>
      <Text className="text-on-surface-variant text-xs mb-1.5 font-semibold">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry
        autoCapitalize="none"
        placeholderTextColor="#94a3b8"
        className="bg-surface-container rounded-lg px-3 py-3 text-on-surface mb-4"
      />
    </>
  );
}

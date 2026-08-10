import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { apiFetch } from "@/lib/api";
import { colors } from "@/lib/theme";
import { useGoBack } from "@/lib/navigation";

export default function MotDePasse() {
  const goBack = useGoBack();
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
      goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la modification");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-app">
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Field label="MOT DE PASSE ACTUEL" value={current} onChangeText={setCurrent} />
        <Field label="NOUVEAU MOT DE PASSE" value={next} onChangeText={setNext} />
        <Field label="CONFIRMER LE NOUVEAU MOT DE PASSE" value={confirm} onChangeText={setConfirm} />

        {error && (
          <View className="bg-danger/10 border border-danger/30 rounded-xl p-3 mb-3">
            <Text className="text-danger text-sm">{error}</Text>
          </View>
        )}

        <Pressable
          onPress={save}
          disabled={saving}
          className={`py-3.5 rounded-full items-center ${saving ? "bg-outline" : "bg-primary"}`}
        >
          {saving ? <ActivityIndicator color={colors.white} /> : <Text className="text-white font-bold">Modifier le mot de passe</Text>}
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
        placeholderTextColor={colors.outline}
        className="bg-surface-container rounded-xl px-3 py-3 text-on-surface mb-4"
      />
    </>
  );
}

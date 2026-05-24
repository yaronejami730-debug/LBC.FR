import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

const CIVILITIES = ["Monsieur", "Madame", "Autre"] as const;

function formatBirth(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
function parseBirth(input: string): { iso: string | null; valid: boolean } {
  const t = input.trim();
  if (!t) return { iso: null, valid: true };
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return { iso: null, valid: false };
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return { iso: null, valid: false };
  }
  return { iso: d.toISOString(), valid: true };
}

type FullProfile = {
  civility?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  birthDate?: string | null;
  addressLine?: string | null;
  companyName?: string | null;
};

export default function InformationsPersonnelles() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [civility, setCivility] = useState("");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [companyName, setCompanyName] = useState(user?.companyName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charge les champs étendus via /api/profile/me (pas dans l'objet user du contexte)
  useEffect(() => {
    apiFetch<{ user: FullProfile }>("/api/profile/me")
      .then(({ user: p }) => {
        if (p.civility) setCivility(p.civility);
        if (p.lastName) setLastName(p.lastName);
        if (p.firstName) setFirstName(p.firstName);
        if (p.birthDate) setBirthDate(formatBirth(p.birthDate));
        if (p.addressLine) setAddressLine(p.addressLine);
        if (p.companyName) setCompanyName(p.companyName);
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setError(null);
    if (!lastName.trim() || !firstName.trim()) { setError("Nom et prénom requis."); return; }
    const bd = parseBirth(birthDate);
    if (!bd.valid) { setError("Date de naissance invalide (jj/mm/aaaa)."); return; }

    setSaving(true);
    try {
      await apiFetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          civility: civility.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          name: `${firstName.trim()} ${lastName.trim()}`,
          birthDate: bd.iso ?? "",
          addressLine: addressLine.trim(),
          ...(user?.isPro ? { companyName: companyName.trim() } : {}),
        }),
      });
      await refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("Enregistré", "Vos informations ont été mises à jour.");
      router.back();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-surface">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text className="text-on-surface text-xl font-extrabold mb-4">Identité</Text>

        <Label>Civilité *</Label>
        <View className="flex-row gap-2 mb-4">
          {CIVILITIES.map((c) => {
            const active = civility === c;
            return (
              <Pressable
                key={c}
                onPress={() => { Haptics.selectionAsync().catch(() => {}); setCivility(c); }}
                className={`flex-1 py-3 rounded-full border-2 items-center ${active ? "border-primary bg-primary/5" : "border-surface-container bg-white"}`}
              >
                <Text className={`text-sm font-bold ${active ? "text-primary" : "text-on-surface-variant"}`}>{c}</Text>
              </Pressable>
            );
          })}
        </View>

        <Label>Nom *</Label>
        <Input value={lastName} onChangeText={setLastName} placeholder="Votre nom" />

        <Label>Prénom *</Label>
        <Input value={firstName} onChangeText={setFirstName} placeholder="Votre prénom" />

        <Label>Date de naissance *</Label>
        <Input
          value={birthDate}
          onChangeText={(t) => setBirthDate(t.replace(/[^\d/]/g, "").slice(0, 10))}
          placeholder="jj/mm/aaaa"
          keyboardType="number-pad"
        />

        <Text className="text-on-surface text-xl font-extrabold mt-6 mb-4">Adresse</Text>
        <Label>Adresse *</Label>
        <Input value={addressLine} onChangeText={setAddressLine} placeholder="Rue, ville, code postal" />

        {user?.isPro && (
          <>
            <Text className="text-on-surface text-xl font-extrabold mt-6 mb-4">Entreprise</Text>
            <Label>Raison sociale</Label>
            <Input value={companyName} onChangeText={setCompanyName} placeholder="Nom de l'entreprise" />
          </>
        )}

        {error && (
          <View className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2 mb-3">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        )}

        <Pressable
          onPress={save}
          disabled={saving}
          className={`py-3.5 rounded-full items-center mt-6 ${saving ? "bg-outline" : "bg-primary"}`}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Enregistrer</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text className="text-on-surface text-sm font-bold mb-1.5">{children}</Text>;
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="#94a3b8"
      className="border border-surface-container rounded-xl px-4 py-3 text-on-surface mb-4 bg-white"
    />
  );
}

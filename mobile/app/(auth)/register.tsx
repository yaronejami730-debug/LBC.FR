import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Switch } from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth";

type AccountType = "particulier" | "pro";

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [accountType, setAccountType] = useState<AccountType>("particulier");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [siret, setSiret] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name.trim() || !email.trim() || !password) { setError("Tous les champs sont requis"); return; }
    if (password.length < 8) { setError("Le mot de passe doit contenir au moins 8 caractères"); return; }
    if (accountType === "pro") {
      if (!companyName.trim()) { setError("Raison sociale requise"); return; }
      if (!/^\d{14}$/.test(siret.replace(/\s/g, ""))) { setError("SIRET invalide (14 chiffres)"); return; }
    }
    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        marketingConsent: marketing,
        ...(accountType === "pro" ? { isPro: true, companyName: companyName.trim(), siret: siret.replace(/\s/g, "") } : {}),
      });
      router.replace("/(auth)/verify-email");
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
          <Text className="text-on-surface-variant text-sm mb-6">Rejoignez Deal&Co gratuitement.</Text>

          {/* Sélecteur type de compte */}
          <Text className="text-on-surface text-sm font-bold mb-2">Type de compte</Text>
          <View className="flex-row gap-2 mb-6">
            <AccountCard
              active={accountType === "particulier"}
              icon="person"
              label="Particulier"
              hint="Vendre et acheter en quelques clics"
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setAccountType("particulier"); }}
            />
            <AccountCard
              active={accountType === "pro"}
              icon="briefcase"
              label="Professionnel"
              hint="Boutique vérifiée, outils CRM, stats"
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setAccountType("pro"); }}
            />
          </View>

          {accountType === "pro" && (
            <>
              <Text className="text-on-surface text-sm font-semibold mb-2">Raison sociale *</Text>
              <TextInput
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="ex : Auto Garage SARL"
                placeholderTextColor="#9ca3af"
                className="border border-surface-container rounded-xl px-4 py-3 text-on-surface mb-4 bg-white"
              />
              <Text className="text-on-surface text-sm font-semibold mb-2">SIRET *</Text>
              <TextInput
                value={siret}
                onChangeText={(t) => setSiret(t.replace(/[^\d]/g, "").slice(0, 14))}
                keyboardType="number-pad"
                placeholder="14 chiffres"
                placeholderTextColor="#9ca3af"
                maxLength={14}
                className="border border-surface-container rounded-xl px-4 py-3 text-on-surface mb-4 bg-white"
              />
            </>
          )}

          <Text className="text-on-surface text-sm font-semibold mb-2">
            {accountType === "pro" ? "Nom du contact" : "Nom complet"} *
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={accountType === "pro" ? "Prénom Nom du responsable" : "Votre nom"}
            placeholderTextColor="#9ca3af"
            className="border border-surface-container rounded-xl px-4 py-3 text-on-surface mb-4 bg-white"
          />

          <Text className="text-on-surface text-sm font-semibold mb-2">Email *</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="vous@exemple.com"
            placeholderTextColor="#9ca3af"
            className="border border-surface-container rounded-xl px-4 py-3 text-on-surface mb-4 bg-white"
          />

          <Text className="text-on-surface text-sm font-semibold mb-2">Mot de passe *</Text>
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

function AccountCard({
  active, icon, label, hint, onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 border-2 rounded-2xl p-4 ${active ? "border-primary bg-primary/5" : "border-surface-container bg-white"}`}
    >
      <View className={`w-10 h-10 rounded-full items-center justify-center mb-2 ${active ? "bg-primary" : "bg-surface-container"}`}>
        <Ionicons name={icon} size={18} color={active ? "#fff" : "#94a3b8"} />
      </View>
      <Text className={`font-bold text-sm ${active ? "text-primary" : "text-on-surface"}`}>{label}</Text>
      <Text className="text-on-surface-variant text-[11px] mt-1 leading-tight">{hint}</Text>
      {active && (
        <View className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full items-center justify-center">
          <Ionicons name="checkmark" size={12} color="#fff" />
        </View>
      )}
    </Pressable>
  );
}

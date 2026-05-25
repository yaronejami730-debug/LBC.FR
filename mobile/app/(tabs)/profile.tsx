import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";
import { getToken } from "@/lib/tokenStore";

async function uploadAvatarAsync(uri: string): Promise<string> {
  const token = await getToken();
  const form = new FormData();
  const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const mime = ext === "png" ? "image/png" : "image/jpeg";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form.append("file", { uri, name: `avatar.${ext}`, type: mime } as any);
  const res = await fetch(`${API_BASE_URL}/api/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data.url as string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, loading, refresh } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  };

  const changeAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (res.canceled || res.assets.length === 0) return;
    setSavingAvatar(true);
    try {
      const url = await uploadAvatarAsync(res.assets[0].uri);
      await apiFetch("/api/profile", { method: "PATCH", body: JSON.stringify({ avatar: url }) });
      await refresh();
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Mise à jour échouée");
    } finally {
      setSavingAvatar(false);
    }
  };

  if (loading) {
    return <SafeAreaView className="flex-1 bg-surface"><View className="flex-1" /></SafeAreaView>;
  }

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 }}>
          <View className="items-center pt-8 pb-4">
            <Image source={require("@/assets/logo.png")} style={{ width: 180, height: 60 }} contentFit="contain" />
          </View>

          <View className="bg-primary/5 border border-primary/20 rounded-3xl p-6 mt-4">
            <View className="w-14 h-14 rounded-full bg-primary items-center justify-center mb-3">
              <Ionicons name="person" size={26} color="#fff" />
            </View>
            <Text className="text-on-surface text-2xl font-extrabold mb-1">Bienvenue !</Text>
            <Text className="text-on-surface-variant text-sm mb-5 leading-relaxed">
              Connectez-vous ou créez un compte gratuit pour publier des annonces, sauvegarder vos favoris et discuter avec les vendeurs.
            </Text>
            <Pressable
              onPress={() => router.push("/(auth)/register")}
              className="bg-primary py-3.5 rounded-full items-center mb-2 active:opacity-80"
            >
              <Text className="text-white font-bold text-base">Créer un compte gratuit</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/(auth)/login")}
              className="border-2 border-primary py-3.5 rounded-full items-center active:opacity-80"
            >
              <Text className="text-primary font-bold text-base">J'ai déjà un compte</Text>
            </Pressable>
          </View>

          <View className="mt-6">
            <Text className="text-on-surface font-bold text-base mb-3">Pourquoi s'inscrire ?</Text>
            <Benefit icon="megaphone" title="Publier vos annonces" desc="Vendez en quelques secondes." />
            <Benefit icon="heart" title="Sauvegarder vos favoris" desc="Retrouvez ce qui vous plaît." />
            <Benefit icon="chatbubbles" title="Discuter avec les vendeurs" desc="Messagerie intégrée sécurisée." />
            <Benefit icon="notifications" title="Alertes personnalisées" desc="Soyez le premier sur les nouveautés." />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const avatar = (user.image as string | null | undefined) ?? null;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="items-center pt-3 pb-2">
          <Image source={require("@/assets/logo.png")} style={{ width: 130, height: 40 }} contentFit="contain" />
        </View>

        <View className="px-4 pt-2 pb-3">
          <View className="bg-surface-container-low rounded-2xl p-5">
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={changeAvatar}
                className="w-16 h-16 rounded-full bg-surface-container overflow-hidden items-center justify-center"
              >
                {savingAvatar ? (
                  <ActivityIndicator color="#2f6fb8" />
                ) : avatar ? (
                  <Image source={{ uri: avatar }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                ) : (
                  <Text className="text-outline text-xl">+</Text>
                )}
              </Pressable>
              <View className="flex-1">
                <Text className="text-on-surface text-lg font-bold">{user.companyName || user.name}</Text>
                <Text className="text-on-surface-variant text-xs">{user.email}</Text>
                {user.isPro && <Text className="text-primary text-xs font-bold mt-1">COMPTE PRO</Text>}
              </View>
            </View>
            {!user.emailVerified && (
              <Pressable
                onPress={() => router.push("/(auth)/verify-email")}
                className="mt-3 bg-amber-100 px-3 py-2.5 rounded-lg flex-row items-center active:opacity-80"
              >
                <Ionicons name="mail-unread" size={16} color="#92400e" />
                <Text className="text-amber-900 text-xs ml-2 flex-1 font-semibold">Email non vérifié — entrer mon code</Text>
                <Ionicons name="chevron-forward" size={16} color="#92400e" />
              </Pressable>
            )}
          </View>
        </View>

        <View className="mt-4">
          <SettingsSection title="Mes contenus">
            <SettingsRow icon="document-text-outline" label="Mes annonces" onPress={() => router.push("/mes-annonces")} />
            <SettingsRow icon="heart-outline" label="Favoris" onPress={() => router.push("/favoris")} last />
          </SettingsSection>

          <SettingsSection title="Compte">
            <SettingsRow icon="person-outline" label="Informations personnelles" onPress={() => router.push("/settings/informations-personnelles")} />
            <SettingsRow icon="mail-outline" label="Adresse email" onPress={() => router.push("/settings/email")} />
            <SettingsRow icon="notifications-outline" label="Notifications" onPress={() => router.push("/settings/notifications")} last />
          </SettingsSection>

          <SettingsSection title="Sécurité et connexion">
            <SettingsRow icon="shield-checkmark-outline" label="Sécurité du compte" onPress={() => router.push("/settings/securite")} />
            <SettingsRow icon="key-outline" label="Mot de passe" onPress={() => router.push("/settings/mot-de-passe")} />
            <SettingsRow icon="call-outline" label="Numéro de téléphone" onPress={() => router.push("/settings/telephone")} />
            <SettingsRow icon="phone-portrait-outline" label="Appareils connectés" onPress={() => router.push("/settings/appareils")} last />
          </SettingsSection>

          <SettingsSection title="Aide">
            <SettingsRow icon="help-circle-outline" label="Aide & support" onPress={() => router.push("/settings/aide")} last />
          </SettingsSection>
        </View>

        <View className="px-4 mt-6">
          <Pressable onPress={logout} className="bg-red-50 border border-red-200 rounded-xl py-3 items-center">
            <Text className="text-red-600 font-semibold">Se déconnecter</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Benefit({ icon, title, desc }: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }) {
  return (
    <View className="flex-row items-center py-2.5">
      <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
        <Ionicons name={icon} size={18} color="#2f6fb8" />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-on-surface font-semibold text-sm">{title}</Text>
        <Text className="text-on-surface-variant text-xs">{desc}</Text>
      </View>
    </View>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="text-on-surface-variant text-xs font-bold uppercase tracking-wider px-4 mb-1.5">{title}</Text>
      <View className="bg-surface-container-low rounded-2xl mx-4 overflow-hidden">{children}</View>
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center px-4 py-3.5 active:bg-surface-container ${last ? "" : "border-b border-surface-container"}`}
    >
      <Ionicons name={icon} size={20} color="#2f6fb8" />
      <Text className="text-on-surface flex-1 ml-3 font-medium">{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
    </Pressable>
  );
}


import { useCallback, useState } from "react";
import { View, Text, ScrollView, Image, Alert, Modal, TextInput, Pressable, Switch } from "react-native";
import { useFocusEffect } from "expo-router";
import { adminData } from "@/lib/adminApi";
import { pickAndUpload } from "@/lib/adminUpload";
import { apiFetch } from "@/lib/api";
import { ActionButton, Empty } from "@/components/admin/AdminScreen";
import { colors } from "@/lib/theme";

type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  bgFrom: string;
  bgTo: string;
  bgImage: string | null;
  textColor: string;
  showText: boolean;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

/**
 * Bannières de la page d'accueil.
 *
 * Une seule est active à la fois — activer la suivante éteint la précédente,
 * exactement comme sur le site. C'est la règle du serveur, pas une convention
 * d'affichage : l'application ne la rejoue pas, elle l'observe.
 */
export default function AdminBanniere() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  /** Formulaire de création — mêmes champs que celui du site. */
  const [draft, setDraft] = useState<{
    title: string;
    subtitle: string;
    bgFrom: string;
    bgTo: string;
    bgImage: string;
    showText: boolean;
    startsAt: string;
    endsAt: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const data = await adminData<{ banners: Banner[] }>("banniere");
      setBanners(data.banners);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function toggle(banner: Banner) {
    setBusyId(banner.id);
    try {
      await apiFetch("/api/admin/hero-banner", {
        method: "PATCH",
        body: JSON.stringify({ id: banner.id, isActive: !banner.isActive }),
      });
      await load();
    } catch (e) {
      Alert.alert("Action impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(banner: Banner) {
    setBusyId(banner.id);
    try {
      await apiFetch("/api/admin/hero-banner", {
        method: "DELETE",
        body: JSON.stringify({ id: banner.id }),
      });
      setBanners((prev) => prev.filter((b) => b.id !== banner.id));
    } catch (e) {
      Alert.alert("Suppression impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setBusyId(null);
    }
  }

  async function upload() {
    setUploading(true);
    try {
      const url = await pickAndUpload();
      if (url) setDraft((prev) => (prev ? { ...prev, bgImage: url } : prev));
    } catch (e) {
      Alert.alert("Envoi impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setUploading(false);
    }
  }

  async function create() {
    if (!draft) return;
    if (draft.title.trim().length < 3) {
      Alert.alert("Titre requis", "Trois caractères au minimum.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/admin/hero-banner", {
        method: "POST",
        body: JSON.stringify({
          title: draft.title,
          subtitle: draft.subtitle || null,
          bgFrom: draft.bgFrom,
          bgTo: draft.bgTo,
          bgImage: draft.bgImage || null,
          showText: draft.showText,
          startsAt: draft.startsAt || null,
          endsAt: draft.endsAt || null,
        }),
      });
      setDraft(null);
      await load();
    } catch (e) {
      Alert.alert("Création impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-app" contentContainerStyle={{ padding: 12 }}>
      {error && (
        <View className="bg-surface rounded-xl px-4 py-3 mb-2">
          <Text className="text-danger text-sm">{error}</Text>
        </View>
      )}

      <Pressable
        onPress={() =>
          setDraft({
            title: "Petites annonces gratuites près de chez vous.",
            subtitle: "",
            bgFrom: "#2f6fb8",
            bgTo: "#1a5a9e",
            bgImage: "",
            showText: true,
            startsAt: "",
            endsAt: "",
          })
        }
        className="rounded-xl items-center py-3 mb-3 active:opacity-70"
        style={{ backgroundColor: colors.primary }}
      >
        <Text className="text-white font-bold">+ Nouvelle bannière</Text>
      </Pressable>

      {banners.length === 0 && !loading && <Empty label="Aucune bannière." />}

      {banners.map((b) => (
        <View key={b.id} className="bg-surface rounded-xl overflow-hidden mb-2">
          <View style={{ height: 90, backgroundColor: b.bgFrom }}>
            {b.bgImage ? (
              <Image source={{ uri: b.bgImage }} style={{ width: "100%", height: 90 }} />
            ) : null}
          </View>
          <View className="p-4">
            <Text className="text-on-surface font-bold">{b.title}</Text>
            {b.subtitle && (
              <Text className="text-on-surface-variant text-xs mt-0.5">{b.subtitle}</Text>
            )}
            <Text className="text-on-surface-variant text-[11px] mt-1">
              {b.isActive ? "En ligne" : "Hors ligne"}
              {b.showText ? "" : " · photo seule"}
              {b.startsAt ? ` · du ${new Date(b.startsAt).toLocaleDateString("fr-FR")}` : ""}
              {b.endsAt ? ` au ${new Date(b.endsAt).toLocaleDateString("fr-FR")}` : ""}
            </Text>

            <View className="flex-row mt-3">
              <ActionButton
                label={b.isActive ? "Retirer" : "Mettre en ligne"}
                tone={b.isActive ? "neutral" : "primary"}
                disabled={busyId === b.id}
                onPress={() => toggle(b)}
              />
              <ActionButton
                label="Supprimer"
                tone="danger"
                disabled={busyId === b.id}
                onPress={() =>
                  Alert.alert("Supprimer la bannière", `« ${b.title} » sera perdue.`, [
                    { text: "Annuler", style: "cancel" },
                    { text: "Supprimer", style: "destructive", onPress: () => remove(b) },
                  ])
                }
              />
            </View>
          </View>
        </View>
      ))}

      <Text className="text-xs text-center mt-3" style={{ color: colors.outline }}>
        Une seule bannière est en ligne à la fois : en activer une éteint la précédente.
      </Text>

      <Modal visible={draft !== null} animationType="slide" onRequestClose={() => setDraft(null)}>
        <ScrollView className="flex-1 bg-app" contentContainerStyle={{ padding: 16 }}>
          <Text className="text-on-surface text-xl font-extrabold mb-3">Nouvelle bannière</Text>

          <Text className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-1.5">
            Titre
          </Text>
          <TextInput
            value={draft?.title}
            onChangeText={(v) => setDraft((p) => (p ? { ...p, title: v } : p))}
            className="rounded-xl px-3 py-3 text-on-surface mb-3"
            style={{ backgroundColor: colors.surfaceContainer }}
          />

          <Text className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-1.5">
            Sous-titre
          </Text>
          <TextInput
            value={draft?.subtitle}
            onChangeText={(v) => setDraft((p) => (p ? { ...p, subtitle: v } : p))}
            placeholder="Texte affiché sous le titre"
            placeholderTextColor={colors.outline}
            className="rounded-xl px-3 py-3 text-on-surface mb-3"
            style={{ backgroundColor: colors.surfaceContainer }}
          />

          <View className="flex-row mb-3">
            <View className="flex-1 mr-2">
              <Text className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-1.5">
                Dégradé — début
              </Text>
              <TextInput
                value={draft?.bgFrom}
                onChangeText={(v) => setDraft((p) => (p ? { ...p, bgFrom: v } : p))}
                autoCapitalize="none"
                className="rounded-xl px-3 py-3 text-on-surface"
                style={{ backgroundColor: colors.surfaceContainer }}
              />
            </View>
            <View className="flex-1">
              <Text className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-1.5">
                Dégradé — fin
              </Text>
              <TextInput
                value={draft?.bgTo}
                onChangeText={(v) => setDraft((p) => (p ? { ...p, bgTo: v } : p))}
                autoCapitalize="none"
                className="rounded-xl px-3 py-3 text-on-surface"
                style={{ backgroundColor: colors.surfaceContainer }}
              />
            </View>
          </View>

          <Text className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-1.5">
            Photo de fond (optionnelle)
          </Text>
          {draft?.bgImage ? (
            <Image
              source={{ uri: draft.bgImage }}
              style={{ width: "100%", height: 120, borderRadius: 12, marginBottom: 8 }}
            />
          ) : null}
          <View className="flex-row mb-3">
            <ActionButton
              label={uploading ? "Envoi…" : draft?.bgImage ? "Remplacer la photo" : "Choisir une photo"}
              disabled={uploading}
              onPress={upload}
            />
          </View>

          <View className="flex-row items-center justify-between bg-surface rounded-xl px-4 py-3 mb-3">
            <Text className="text-on-surface text-sm flex-1 mr-3">
              Afficher le titre et le sous-titre
            </Text>
            <Switch
              value={draft?.showText ?? true}
              onValueChange={(v) => setDraft((p) => (p ? { ...p, showText: v } : p))}
            />
          </View>

          <Text className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-1.5">
            Début (optionnel)
          </Text>
          <TextInput
            value={draft?.startsAt}
            onChangeText={(v) => setDraft((p) => (p ? { ...p, startsAt: v } : p))}
            placeholder="AAAA-MM-JJTHH:MM"
            placeholderTextColor={colors.outline}
            autoCapitalize="none"
            className="rounded-xl px-3 py-3 text-on-surface mb-3"
            style={{ backgroundColor: colors.surfaceContainer }}
          />

          <Text className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-1.5">
            Fin (optionnel)
          </Text>
          <TextInput
            value={draft?.endsAt}
            onChangeText={(v) => setDraft((p) => (p ? { ...p, endsAt: v } : p))}
            placeholder="AAAA-MM-JJTHH:MM"
            placeholderTextColor={colors.outline}
            autoCapitalize="none"
            className="rounded-xl px-3 py-3 text-on-surface mb-3"
            style={{ backgroundColor: colors.surfaceContainer }}
          />

          <View className="flex-row mt-2">
            <ActionButton label="Annuler" onPress={() => setDraft(null)} />
            <ActionButton
              label={saving ? "Création…" : "Créer"}
              tone="primary"
              disabled={saving || uploading}
              onPress={create}
            />
          </View>
        </ScrollView>
      </Modal>
    </ScrollView>
  );
}

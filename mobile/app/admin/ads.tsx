import { useCallback, useState } from "react";
import { View, Text, ScrollView, Image, Alert, TextInput, Pressable, Modal } from "react-native";
import { useFocusEffect } from "expo-router";
import { adminAction, adminData } from "@/lib/adminApi";
import { pickAndUpload } from "@/lib/adminUpload";
import { ActionButton, Empty } from "@/components/admin/AdminScreen";
import { colors } from "@/lib/theme";

type Ad = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imageUrlWide: string | null;
  destinationUrl: string;
  isActive: boolean;
  clicks: number;
  impressions: number;
  impCarousel: number;
  impRotator: number;
  impGrid: number;
  scheduledAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

type Draft = {
  id?: string;
  title: string;
  description: string;
  destinationUrl: string;
  imageUrl: string;
  imageUrlWide: string;
  scheduledAt: string;
  expiresAt: string;
};

const EMPTY: Draft = {
  title: "",
  description: "",
  destinationUrl: "",
  imageUrl: "",
  imageUrlWide: "",
  scheduledAt: "",
  expiresAt: "",
};

const input = { backgroundColor: colors.surfaceContainer } as const;

/**
 * Publicités — création, édition, statistiques, activation, suppression.
 *
 * Les mêmes champs que le formulaire du site, y compris le second visuel large
 * utilisé par la bannière d'accueil : une campagne créée depuis le téléphone
 * n'est pas une campagne au rabais.
 */
export default function AdminAds() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploading, setUploading] = useState<"square" | "wide" | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const data = await adminData<{ ads: Ad[] }>("ads");
      setAds(data.ads);
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

  async function run(id: string, name: string, args: unknown[]) {
    setBusyId(id);
    try {
      await adminAction(name, ...args);
      await load();
    } catch (e) {
      Alert.alert("Action impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setBusyId(null);
    }
  }

  async function upload(kind: "square" | "wide") {
    setUploading(kind);
    try {
      const url = await pickAndUpload();
      if (url) {
        setDraft((prev) =>
          prev ? { ...prev, [kind === "square" ? "imageUrl" : "imageUrlWide"]: url } : prev,
        );
      }
    } catch (e) {
      Alert.alert("Envoi impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    if (!draft) return;
    if (!draft.title || !draft.description || !draft.imageUrl || !draft.destinationUrl) {
      Alert.alert("Champs manquants", "Titre, description, visuel et URL de destination sont requis.");
      return;
    }
    setSaving(true);
    try {
      const fields = {
        title: draft.title,
        description: draft.description,
        destinationUrl: draft.destinationUrl,
        imageUrl: draft.imageUrl,
        imageUrlWide: draft.imageUrlWide,
        scheduledAt: draft.scheduledAt,
        expiresAt: draft.expiresAt,
      };
      if (draft.id) await adminAction("updateAdvertisement", draft.id, fields);
      else await adminAction("createAdvertisement", fields);
      setDraft(null);
      await load();
    } catch (e) {
      Alert.alert("Enregistrement impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-app">
      <ScrollView contentContainerStyle={{ padding: 12 }}>
        {error && (
          <View className="bg-surface rounded-xl px-4 py-3 mb-2">
            <Text className="text-danger text-sm">{error}</Text>
          </View>
        )}

        <Pressable
          onPress={() => setDraft({ ...EMPTY })}
          className="rounded-xl items-center py-3 mb-3 active:opacity-70"
          style={{ backgroundColor: colors.primary }}
        >
          <Text className="text-white font-bold">+ Nouvelle publicité</Text>
        </Pressable>

        {ads.length === 0 && !loading && <Empty label="Aucune publicité." />}

        {ads.map((ad) => {
          const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : "0.00";
          return (
            <View key={ad.id} className="bg-surface rounded-xl p-4 mb-2">
              <View className="flex-row">
                {ad.imageUrl ? (
                  <Image source={{ uri: ad.imageUrl }} style={{ width: 64, height: 64, borderRadius: 10 }} />
                ) : null}
                <View className="flex-1 ml-3">
                  <Text className="text-on-surface font-bold" numberOfLines={1}>
                    {ad.title}
                  </Text>
                  <Text className="text-on-surface-variant text-xs mt-0.5" numberOfLines={2}>
                    {ad.description}
                  </Text>
                  <Text className="text-on-surface-variant text-xs mt-1">
                    {ad.impressions} impressions · {ad.clicks} clics · CTR {ctr} %
                  </Text>
                </View>
              </View>

              {/* Répartition par emplacement, comme sur le site : une campagne
                  peut très bien marcher en page annonce et pas en accueil. */}
              <Text className="text-on-surface-variant text-[11px] mt-2">
                Accueil {ad.impCarousel} · page annonce {ad.impRotator} · fil {ad.impGrid}
              </Text>
              <Text className="text-on-surface-variant text-[11px] mt-0.5">
                {ad.isActive ? "Active" : "En pause"}
                {ad.scheduledAt
                  ? ` · programmée le ${new Date(ad.scheduledAt).toLocaleDateString("fr-FR")}`
                  : ""}
                {ad.expiresAt ? ` · expire le ${new Date(ad.expiresAt).toLocaleDateString("fr-FR")}` : ""}
              </Text>

              <View className="flex-row mt-3">
                <ActionButton
                  label="Modifier"
                  disabled={busyId === ad.id}
                  onPress={() =>
                    setDraft({
                      id: ad.id,
                      title: ad.title,
                      description: ad.description,
                      destinationUrl: ad.destinationUrl,
                      imageUrl: ad.imageUrl,
                      imageUrlWide: ad.imageUrlWide ?? "",
                      scheduledAt: ad.scheduledAt ? ad.scheduledAt.slice(0, 16) : "",
                      expiresAt: ad.expiresAt ? ad.expiresAt.slice(0, 16) : "",
                    })
                  }
                />
                <ActionButton
                  label={ad.isActive ? "Pause" : "Activer"}
                  tone={ad.isActive ? "neutral" : "primary"}
                  disabled={busyId === ad.id}
                  onPress={() => run(ad.id, "toggleAdStatus", [ad.id, !ad.isActive])}
                />
                <ActionButton
                  label="Supprimer"
                  tone="danger"
                  disabled={busyId === ad.id}
                  onPress={() =>
                    Alert.alert("Supprimer la publicité", `« ${ad.title} » sera retirée définitivement.`, [
                      { text: "Annuler", style: "cancel" },
                      {
                        text: "Supprimer",
                        style: "destructive",
                        onPress: () => run(ad.id, "deleteAdvertisement", [ad.id]),
                      },
                    ])
                  }
                />
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={draft !== null} animationType="slide" onRequestClose={() => setDraft(null)}>
        <ScrollView className="flex-1 bg-app" contentContainerStyle={{ padding: 16 }}>
          <Text className="text-on-surface text-xl font-extrabold mb-3">
            {draft?.id ? "Modifier la publicité" : "Nouvelle publicité"}
          </Text>

          <Field label="Titre">
            <TextInput
              value={draft?.title}
              onChangeText={(v) => setDraft((p) => (p ? { ...p, title: v } : p))}
              placeholder="Titre affiché"
              placeholderTextColor={colors.outline}
              className="rounded-xl px-3 py-3 text-on-surface"
              style={input}
            />
          </Field>

          <Field label="Description courte">
            <TextInput
              value={draft?.description}
              onChangeText={(v) => setDraft((p) => (p ? { ...p, description: v } : p))}
              placeholder="Une phrase"
              placeholderTextColor={colors.outline}
              multiline
              className="rounded-xl px-3 py-3 text-on-surface"
              style={{ ...input, minHeight: 80 }}
            />
          </Field>

          <Field label="URL de destination">
            <TextInput
              value={draft?.destinationUrl}
              onChangeText={(v) => setDraft((p) => (p ? { ...p, destinationUrl: v } : p))}
              placeholder="https://…"
              placeholderTextColor={colors.outline}
              autoCapitalize="none"
              className="rounded-xl px-3 py-3 text-on-surface"
              style={input}
            />
          </Field>

          <Field label="Visuel carré (fil d'annonces)">
            {draft?.imageUrl ? (
              <Image
                source={{ uri: draft.imageUrl }}
                style={{ width: "100%", height: 160, borderRadius: 12, marginBottom: 8 }}
              />
            ) : null}
            <ActionButton
              label={uploading === "square" ? "Envoi…" : draft?.imageUrl ? "Remplacer" : "Choisir une image"}
              disabled={uploading !== null}
              onPress={() => upload("square")}
            />
          </Field>

          <Field label="Visuel large (bannière d'accueil, optionnel)">
            {draft?.imageUrlWide ? (
              <Image
                source={{ uri: draft.imageUrlWide }}
                style={{ width: "100%", height: 110, borderRadius: 12, marginBottom: 8 }}
              />
            ) : null}
            <ActionButton
              label={uploading === "wide" ? "Envoi…" : draft?.imageUrlWide ? "Remplacer" : "Choisir une image"}
              disabled={uploading !== null}
              onPress={() => upload("wide")}
            />
          </Field>

          <Field label="Activation (optionnel)">
            <TextInput
              value={draft?.scheduledAt}
              onChangeText={(v) => setDraft((p) => (p ? { ...p, scheduledAt: v } : p))}
              placeholder="AAAA-MM-JJTHH:MM"
              placeholderTextColor={colors.outline}
              autoCapitalize="none"
              className="rounded-xl px-3 py-3 text-on-surface"
              style={input}
            />
          </Field>

          <Field label="Désactivation (optionnel)">
            <TextInput
              value={draft?.expiresAt}
              onChangeText={(v) => setDraft((p) => (p ? { ...p, expiresAt: v } : p))}
              placeholder="AAAA-MM-JJTHH:MM"
              placeholderTextColor={colors.outline}
              autoCapitalize="none"
              className="rounded-xl px-3 py-3 text-on-surface"
              style={input}
            />
          </Field>

          <View className="flex-row mt-4">
            <ActionButton label="Annuler" onPress={() => setDraft(null)} />
            <ActionButton
              label={saving ? "Enregistrement…" : "Enregistrer"}
              tone="primary"
              disabled={saving || uploading !== null}
              onPress={save}
            />
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-3">
      <Text className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-1.5">
        {label}
      </Text>
      {children}
    </View>
  );
}

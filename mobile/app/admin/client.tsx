import { useCallback, useState } from "react";
import { View, Text, ScrollView, Alert, Modal, TextInput, Pressable } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { adminAction, adminData } from "@/lib/adminApi";
import { ActionButton, Empty } from "@/components/admin/AdminScreen";
import { colors } from "@/lib/theme";

type Client = {
  id: string;
  name: string;
  email: string;
  isPro: boolean;
  companyName: string | null;
  siret: string | null;
  verified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  consentGivenAt: string | null;
  bannedAt: string | null;
  banReason: string | null;
  watchedAt: string | null;
  watchReason: string | null;
  phoneNumber: string | null;
  adminNote: string | null;
  role: string;
  _count: { listings: number };
};

type Listing = {
  id: string;
  title: string;
  price: number;
  status: string;
  category: string;
  location: string;
  images: string[];
  createdAt: string;
  rejectionReason: string | null;
};

type TrustSignal = { label: string; delta: number; family: string };
type TrustProfile = {
  score: number;
  level: string;
  levelLabel: string;
  signals: TrustSignal[];
  stats: Record<string, number>;
};

/**
 * Fiche client du CRM — la même que `/admin/clients/[id]`.
 *
 * Identité modifiable, score de confiance, sanctions, et les annonces du
 * compte avec leurs décisions. C'est l'écran qu'on ouvre quand quelqu'un
 * appelle pour se plaindre : tout ce qui le concerne doit y être.
 */
export default function AdminClient() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [trust, setTrust] = useState<TrustProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [edit, setEdit] = useState<{ field: "name" | "phone" | "company"; value: string } | null>(null);
  const [prompt, setPrompt] = useState<{ action: "ban" | "watch"; title: string } | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setError(null);
      const [data, trustData] = await Promise.all([
        adminData<{ user?: Client; listings?: Listing[]; error?: string }>("client", { id }),
        adminData<{ profile: TrustProfile | null }>("trust", { id }).catch(() => ({ profile: null })),
      ]);
      if (data.error || !data.user) throw new Error(data.error ?? "Compte introuvable");
      setClient(data.user);
      setListings(data.listings ?? []);
      setTrust(trustData.profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function run(name: string, args: unknown[], done?: string) {
    setBusy(true);
    try {
      await adminAction(name, ...args);
      await load();
      if (done) Alert.alert("Fait", done);
    } catch (e) {
      Alert.alert("Action impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <View className="flex-1 bg-app p-4">
        <View className="bg-surface rounded-xl px-4 py-3">
          <Text className="text-danger text-sm">{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-app" contentContainerStyle={{ padding: 16 }}>
      {client && (
        <>
          <View className="bg-surface rounded-xl p-4 mb-3">
            <Text className="text-on-surface text-lg font-extrabold">
              {client.companyName || client.name}
            </Text>
            <Text className="text-on-surface-variant text-xs mt-0.5">{client.email}</Text>
            <Text className="text-on-surface-variant text-xs mt-1">
              {client.isPro ? "Professionnel" : "Particulier"}
              {client.siret ? ` · SIRET ${client.siret}` : ""}
              {client.role === "ADMIN" ? " · administrateur" : ""}
            </Text>
            <Text className="text-on-surface-variant text-xs mt-0.5">
              Inscrit le {new Date(client.createdAt).toLocaleDateString("fr-FR")}
              {client.lastLoginAt
                ? ` · dernière connexion ${new Date(client.lastLoginAt).toLocaleDateString("fr-FR")}`
                : " · jamais connecté"}
            </Text>
            <Text className="text-on-surface-variant text-xs mt-0.5">
              {client._count.listings} annonce{client._count.listings > 1 ? "s" : ""} · téléphone{" "}
              {client.phoneNumber ?? "non renseigné"}
            </Text>
            {client.bannedAt && (
              <Text className="text-xs mt-2" style={{ color: colors.danger }}>
                Banni — {client.banReason ?? "sans motif"}
              </Text>
            )}
            {client.watchedAt && (
              <Text className="text-xs mt-1" style={{ color: "#B8860B" }}>
                Sous surveillance — {client.watchReason ?? "sans motif"}
              </Text>
            )}
            {!client.consentGivenAt && (
              <Text className="text-on-surface-variant text-xs mt-1">
                CGU non acceptées — relance possible ci-dessous.
              </Text>
            )}
          </View>

          {/* Score de confiance — le même profil que le dossier du site. */}
          {trust && (
            <View className="bg-surface rounded-xl p-4 mb-3">
              <View className="flex-row items-center">
                <Text className="text-on-surface font-bold flex-1">Score de confiance</Text>
                <Text className="text-2xl font-extrabold" style={{ color: colors.primary }}>
                  {trust.score}
                </Text>
              </View>
              <Text className="text-on-surface-variant text-xs mt-0.5">{trust.levelLabel}</Text>
              {trust.signals.slice(0, 8).map((s, i) => (
                <Text
                  key={`${s.label}-${i}`}
                  className="text-xs mt-1"
                  style={{ color: s.delta > 0 ? colors.success : colors.danger }}
                >
                  {s.delta > 0 ? "+" : ""}
                  {s.delta} · {s.label}
                </Text>
              ))}
            </View>
          )}

          <View className="bg-surface rounded-xl p-4 mb-3">
            <Text className="text-on-surface font-bold mb-2">Identité</Text>
            <View className="flex-row mb-2">
              <ActionButton
                label="Nom"
                disabled={busy}
                onPress={() => setEdit({ field: "name", value: client.name })}
              />
              <ActionButton
                label="Téléphone"
                disabled={busy}
                onPress={() => setEdit({ field: "phone", value: client.phoneNumber ?? "" })}
              />
              {client.isPro && (
                <ActionButton
                  label="Enseigne"
                  disabled={busy}
                  onPress={() => setEdit({ field: "company", value: client.companyName ?? "" })}
                />
              )}
            </View>
            <View className="flex-row">
              <ActionButton
                label={client.verified ? "Retirer le badge" : "Accorder le badge"}
                disabled={busy}
                onPress={() => run("setVerificationBadge", [client.id, !client.verified])}
              />
              {!client.consentGivenAt && (
                <ActionButton
                  label="Relancer les CGU"
                  disabled={busy}
                  onPress={() =>
                    run("sendConsentReminderToUser", [client.id], "Relance envoyée.")
                  }
                />
              )}
            </View>
          </View>

          <View className="bg-surface rounded-xl p-4 mb-3">
            <Text className="text-on-surface font-bold mb-2">Sanctions</Text>
            <View className="flex-row mb-2">
              {client.watchedAt ? (
                <ActionButton
                  label="Lever la surveillance"
                  disabled={busy}
                  onPress={() => run("unwatchAccountAction", [client.id])}
                />
              ) : (
                <ActionButton
                  label="Surveiller"
                  disabled={busy}
                  onPress={() => {
                    setReason("");
                    setPrompt({ action: "watch", title: "Mettre sous surveillance" });
                  }}
                />
              )}
              {client.bannedAt ? (
                <ActionButton
                  label="Lever le bannissement"
                  tone="primary"
                  disabled={busy}
                  onPress={() => run("unbanAccountAction", [client.id])}
                />
              ) : (
                <ActionButton
                  label="Bannir"
                  tone="danger"
                  disabled={busy || client.role === "ADMIN"}
                  onPress={() => {
                    setReason("");
                    setPrompt({ action: "ban", title: "Bannir le compte" });
                  }}
                />
              )}
            </View>
          </View>

          <Text className="text-on-surface font-bold mb-2">
            Annonces ({listings.length})
          </Text>
          {listings.length === 0 && !loading && <Empty label="Aucune annonce." />}
          {listings.map((l) => (
            <View key={l.id} className="bg-surface rounded-xl p-4 mb-2">
              <Pressable onPress={() => router.push(`/annonce/${l.id}`)}>
                <Text className="text-on-surface font-semibold text-sm" numberOfLines={2}>
                  {l.title}
                </Text>
              </Pressable>
              <Text className="text-on-surface-variant text-xs mt-0.5">
                {l.price.toLocaleString("fr-FR")} € · {l.category} · {l.status}
              </Text>
              {l.rejectionReason && (
                <Text className="text-on-surface-variant text-xs mt-1 italic">
                  {l.rejectionReason}
                </Text>
              )}
              <View className="flex-row mt-3">
                {l.status !== "APPROVED" && (
                  <ActionButton
                    label="Valider"
                    tone="primary"
                    disabled={busy}
                    onPress={() => run("approveListing", [l.id])}
                  />
                )}
                <ActionButton
                  label="Supprimer"
                  tone="danger"
                  disabled={busy}
                  onPress={() =>
                    Alert.alert("Supprimer l'annonce", `« ${l.title} » sera retirée.`, [
                      { text: "Annuler", style: "cancel" },
                      {
                        text: "Supprimer",
                        style: "destructive",
                        onPress: () => run("deleteListingByAdmin", [l.id]),
                      },
                    ])
                  }
                />
              </View>
            </View>
          ))}
        </>
      )}

      {/* Édition d'un champ d'identité */}
      <Modal visible={edit !== null} transparent animationType="slide" onRequestClose={() => setEdit(null)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.35)" }}>
          <View className="bg-surface rounded-t-2xl p-5">
            <Text className="text-on-surface font-bold text-base">
              {edit?.field === "name"
                ? "Nom du compte"
                : edit?.field === "phone"
                  ? "Numéro de téléphone"
                  : "Nom commercial"}
            </Text>
            <TextInput
              value={edit?.value}
              onChangeText={(v) => setEdit((p) => (p ? { ...p, value: v } : p))}
              placeholderTextColor={colors.outline}
              autoCapitalize={edit?.field === "phone" ? "none" : "words"}
              className="mt-3 rounded-xl px-3 py-3 text-on-surface"
              style={{ backgroundColor: colors.surfaceContainer }}
            />
            <View className="flex-row mt-4">
              <ActionButton label="Annuler" onPress={() => setEdit(null)} />
              <ActionButton
                label="Enregistrer"
                tone="primary"
                onPress={() => {
                  const target = edit;
                  setEdit(null);
                  if (!target || !client) return;
                  const value = target.value.trim();
                  if (target.field === "name") void run("updateUserName", [client.id, value]);
                  else if (target.field === "phone")
                    void run("updateUserPhone", [client.id, value || null]);
                  else void run("updateClientDisplayName", [client.id, value]);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Motif d'une sanction */}
      <Modal visible={prompt !== null} transparent animationType="slide" onRequestClose={() => setPrompt(null)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.35)" }}>
          <View className="bg-surface rounded-t-2xl p-5">
            <Text className="text-on-surface font-bold text-base">{prompt?.title}</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Motif, conservé dans l'historique"
              placeholderTextColor={colors.outline}
              multiline
              className="mt-3 rounded-xl px-3 py-3 text-on-surface"
              style={{ backgroundColor: colors.surfaceContainer, minHeight: 90 }}
            />
            <View className="flex-row mt-4">
              <ActionButton label="Annuler" onPress={() => setPrompt(null)} />
              <ActionButton
                label="Confirmer"
                tone={prompt?.action === "ban" ? "danger" : "primary"}
                onPress={() => {
                  const motif = reason.trim();
                  if (motif.length < 3) {
                    Alert.alert("Motif requis", "Expliquez en une phrase.");
                    return;
                  }
                  const target = prompt;
                  setPrompt(null);
                  if (!target || !client) return;
                  void run(
                    target.action === "ban" ? "banAccountAction" : "watchAccountAction",
                    [client.id, motif],
                  );
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

import { useCallback, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, Alert, Modal, Switch } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { adminAction, adminData } from "@/lib/adminApi";
import { ActionButton, Empty, Tabs } from "@/components/admin/AdminScreen";
import { colors } from "@/lib/theme";

type Client = {
  id: string;
  name: string;
  email: string;
  companyName: string | null;
  siret: string | null;
  createdAt: string;
  emailVerified: boolean;
  _count: { listings: number };
};

type Source = {
  id: string;
  label: string;
  kind: string;
  url: string;
  domain: string | null;
  active: boolean;
  lastSyncedAt: string | null;
};

const TABS = [
  { value: "clients", label: "Clients" },
  { value: "sources", label: "Sources externes" },
];

/**
 * CRM — clients professionnels et sources externes.
 *
 * Le site propose quatre entrées (clients, sources, leads, agences), les deux
 * dernières étant annoncées « bientôt » : elles n'ont pas d'écran ici non plus,
 * plutôt qu'une page vide qui ferait croire à une panne.
 */
export default function AdminCrm() {
  const router = useRouter();
  const [tab, setTab] = useState("clients");
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  /** Import d'une annonce depuis un lien, pour le compte d'un client. */
  const [importFor, setImportFor] = useState<Client | null>(null);
  const [importUrl, setImportUrl] = useState("");

  /** Création d'un compte client — le vendeur ne s'inscrit pas lui-même. */
  const [newClient, setNewClient] = useState<{
    email: string;
    name: string;
    isPro: boolean;
    companyName: string;
    siret: string;
  } | null>(null);

  /** Nouvelle source externe à scraper. */
  const [newSource, setNewSource] = useState<{ label: string; url: string; ownerEmail: string } | null>(
    null,
  );

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      setError(null);
      const data = await adminData<{ clients: Client[]; sources: Source[] }>("crm", { q });
      setClients(data.clients);
      setSources(data.sources);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load("");
    }, [load]),
  );

  async function run(id: string, name: string, args: unknown[], done?: string) {
    setBusyId(id);
    try {
      await adminAction(name, ...args);
      await load(search);
      if (done) Alert.alert("Fait", done);
    } catch (e) {
      Alert.alert("Action impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View className="flex-1 bg-app">
      <View className="px-4 pt-4">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
      </View>

      {tab === "clients" && (
        <View className="flex-row px-4 pb-2">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Nom, email, enseigne…"
            placeholderTextColor={colors.outline}
            onSubmitEditing={() => load(search)}
            className="flex-1 rounded-xl px-3 py-2.5 text-on-surface mr-2"
            style={{ backgroundColor: colors.surface }}
          />
          <Pressable
            onPress={() => load(search)}
            className="px-4 justify-center rounded-xl"
            style={{ backgroundColor: colors.primary }}
          >
            <Text className="text-white font-bold text-sm">Chercher</Text>
          </Pressable>
        </View>
      )}

      {error && (
        <View className="mx-4 mb-2 bg-surface rounded-xl px-4 py-3">
          <Text className="text-danger text-sm">{error}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 12 }}>
        <Pressable
          onPress={() =>
            tab === "clients"
              ? setNewClient({ email: "", name: "", isPro: true, companyName: "", siret: "" })
              : setNewSource({ label: "", url: "", ownerEmail: "" })
          }
          className="rounded-xl items-center py-3 mb-3 active:opacity-70"
          style={{ backgroundColor: colors.primary }}
        >
          <Text className="text-white font-bold">
            {tab === "clients" ? "+ Créer un compte client" : "+ Ajouter une source"}
          </Text>
        </Pressable>

        {tab === "clients" && clients.length === 0 && !loading && <Empty label="Aucun client." />}

        {tab === "clients" &&
          clients.map((c) => (
            <View key={c.id} className="bg-surface rounded-xl p-4 mb-2">
              <Pressable onPress={() => router.push(`/admin/client?id=${c.id}`)}>
                <Text className="text-on-surface font-bold">{c.companyName || c.name}</Text>
              </Pressable>
              <Text className="text-on-surface-variant text-xs mt-0.5">{c.email}</Text>
              <Text className="text-on-surface-variant text-xs mt-0.5">
                {c._count.listings} annonce{c._count.listings > 1 ? "s" : ""}
                {c.siret ? ` · SIRET ${c.siret}` : ""} · email{" "}
                {c.emailVerified ? "vérifié" : "non vérifié"}
              </Text>
              <View className="flex-row mt-3">
                <ActionButton
                  label="Importer un lien"
                  tone="primary"
                  disabled={busyId === c.id}
                  onPress={() => {
                    setImportUrl("");
                    setImportFor(c);
                  }}
                />
                {!c.emailVerified && (
                  <ActionButton
                    label="Relancer l'invitation"
                    disabled={busyId === c.id}
                    onPress={() => run(c.id, "resendInvitation", [c.id], "Invitation renvoyée.")}
                  />
                )}
              </View>
            </View>
          ))}

        {tab === "sources" && sources.length === 0 && !loading && <Empty label="Aucune source." />}

        {tab === "sources" &&
          sources.map((s) => (
            <View key={s.id} className="bg-surface rounded-xl p-4 mb-2">
              <Text className="text-on-surface font-bold" numberOfLines={1}>
                {s.label || s.url}
              </Text>
              <Text className="text-on-surface-variant text-xs mt-0.5" numberOfLines={1}>
                {s.url}
              </Text>
              <Text className="text-on-surface-variant text-xs mt-0.5">
                {s.active ? "Active" : "En pause"} · {s.kind}
                {s.lastSyncedAt
                  ? ` · dernière synchro ${new Date(s.lastSyncedAt).toLocaleDateString("fr-FR")}`
                  : " · jamais synchronisée"}
              </Text>
              <View className="flex-row mt-3">
                <ActionButton
                  label="Synchroniser"
                  tone="primary"
                  disabled={busyId === s.id}
                  onPress={() => run(s.id, "runExternalSourceSync", [s.id], "Synchronisation lancée.")}
                />
                <ActionButton
                  label={s.active ? "Mettre en pause" : "Réactiver"}
                  disabled={busyId === s.id}
                  onPress={() => run(s.id, "toggleExternalSource", [s.id, !s.active])}
                />
              </View>
            </View>
          ))}
      </ScrollView>

      <Modal visible={newClient !== null} animationType="slide" onRequestClose={() => setNewClient(null)}>
        <ScrollView className="flex-1 bg-app" contentContainerStyle={{ padding: 16 }}>
          <Text className="text-on-surface text-xl font-extrabold mb-1">Nouveau client</Text>
          <Text className="text-on-surface-variant text-xs mb-3">
            Le compte est créé avec un mot de passe provisoire, envoyé par email au client.
          </Text>

          <TextInput
            value={newClient?.email}
            onChangeText={(v) => setNewClient((p) => (p ? { ...p, email: v } : p))}
            placeholder="Email"
            placeholderTextColor={colors.outline}
            autoCapitalize="none"
            keyboardType="email-address"
            className="rounded-xl px-3 py-3 text-on-surface mb-2"
            style={{ backgroundColor: colors.surfaceContainer }}
          />
          <TextInput
            value={newClient?.name}
            onChangeText={(v) => setNewClient((p) => (p ? { ...p, name: v } : p))}
            placeholder="Nom du contact"
            placeholderTextColor={colors.outline}
            className="rounded-xl px-3 py-3 text-on-surface mb-2"
            style={{ backgroundColor: colors.surfaceContainer }}
          />

          <View className="flex-row items-center justify-between bg-surface rounded-xl px-4 py-3 mb-2">
            <Text className="text-on-surface text-sm flex-1 mr-3">Compte professionnel</Text>
            <Switch
              value={newClient?.isPro ?? false}
              onValueChange={(v) => setNewClient((p) => (p ? { ...p, isPro: v } : p))}
            />
          </View>

          {newClient?.isPro && (
            <>
              <TextInput
                value={newClient?.companyName}
                onChangeText={(v) => setNewClient((p) => (p ? { ...p, companyName: v } : p))}
                placeholder="Enseigne"
                placeholderTextColor={colors.outline}
                className="rounded-xl px-3 py-3 text-on-surface mb-2"
                style={{ backgroundColor: colors.surfaceContainer }}
              />
              <TextInput
                value={newClient?.siret}
                onChangeText={(v) => setNewClient((p) => (p ? { ...p, siret: v } : p))}
                placeholder="SIRET"
                placeholderTextColor={colors.outline}
                autoCapitalize="none"
                className="rounded-xl px-3 py-3 text-on-surface mb-2"
                style={{ backgroundColor: colors.surfaceContainer }}
              />
            </>
          )}

          <View className="flex-row mt-3">
            <ActionButton label="Annuler" onPress={() => setNewClient(null)} />
            <ActionButton
              label="Créer"
              tone="primary"
              onPress={() => {
                const draft = newClient;
                if (!draft?.email.trim() || !draft.name.trim()) {
                  Alert.alert("Champs requis", "Email et nom du contact.");
                  return;
                }
                setNewClient(null);
                void run(
                  "new-client",
                  "createClientAccount",
                  [
                    draft.email.trim(),
                    draft.name.trim(),
                    draft.isPro,
                    draft.companyName.trim() || null,
                    draft.siret.trim() || null,
                  ],
                  "Compte créé, invitation envoyée.",
                );
              }}
            />
          </View>
        </ScrollView>
      </Modal>

      <Modal visible={newSource !== null} animationType="slide" onRequestClose={() => setNewSource(null)}>
        <ScrollView className="flex-1 bg-app" contentContainerStyle={{ padding: 16 }}>
          <Text className="text-on-surface text-xl font-extrabold mb-1">Nouvelle source</Text>
          <Text className="text-on-surface-variant text-xs mb-3">
            Les annonces importées sont publiées au nom du compte propriétaire indiqué.
          </Text>

          <TextInput
            value={newSource?.label}
            onChangeText={(v) => setNewSource((p) => (p ? { ...p, label: v } : p))}
            placeholder="Nom public de la source"
            placeholderTextColor={colors.outline}
            className="rounded-xl px-3 py-3 text-on-surface mb-2"
            style={{ backgroundColor: colors.surfaceContainer }}
          />
          <TextInput
            value={newSource?.url}
            onChangeText={(v) => setNewSource((p) => (p ? { ...p, url: v } : p))}
            placeholder="https://…"
            placeholderTextColor={colors.outline}
            autoCapitalize="none"
            className="rounded-xl px-3 py-3 text-on-surface mb-2"
            style={{ backgroundColor: colors.surfaceContainer }}
          />
          <TextInput
            value={newSource?.ownerEmail}
            onChangeText={(v) => setNewSource((p) => (p ? { ...p, ownerEmail: v } : p))}
            placeholder="Email du compte propriétaire"
            placeholderTextColor={colors.outline}
            autoCapitalize="none"
            keyboardType="email-address"
            className="rounded-xl px-3 py-3 text-on-surface mb-2"
            style={{ backgroundColor: colors.surfaceContainer }}
          />

          <View className="flex-row mt-3">
            <ActionButton label="Annuler" onPress={() => setNewSource(null)} />
            <ActionButton
              label="Ajouter"
              tone="primary"
              onPress={() => {
                const draft = newSource;
                if (!draft?.label.trim() || !draft.url.trim() || !draft.ownerEmail.trim()) {
                  Alert.alert("Champs requis", "Libellé, adresse de la source et email du propriétaire.");
                  return;
                }
                setNewSource(null);
                // L'action accepte l'email du propriétaire : inutile de passer
                // par le sélecteur de comptes du site, qui existe seulement
                // parce qu'un formulaire web ne se tape pas au clavier virtuel.
                void run(
                  "new-source",
                  "addExternalSource",
                  [
                    {
                      label: draft.label.trim(),
                      url: draft.url.trim(),
                      ownerEmail: draft.ownerEmail.trim(),
                    },
                  ],
                  "Source ajoutée.",
                );
              }}
            />
          </View>
        </ScrollView>
      </Modal>

      <Modal visible={importFor !== null} transparent animationType="slide" onRequestClose={() => setImportFor(null)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.35)" }}>
          <View className="bg-surface rounded-t-2xl p-5">
            <Text className="text-on-surface font-bold text-base">Importer une annonce</Text>
            <Text className="text-on-surface-variant text-xs mt-1">
              Pour {importFor?.companyName || importFor?.name}
            </Text>
            <TextInput
              value={importUrl}
              onChangeText={setImportUrl}
              placeholder="https://…"
              placeholderTextColor={colors.outline}
              autoCapitalize="none"
              className="mt-3 rounded-xl px-3 py-3 text-on-surface"
              style={{ backgroundColor: colors.surfaceContainer }}
            />
            <View className="flex-row mt-4">
              <ActionButton label="Annuler" onPress={() => setImportFor(null)} />
              <ActionButton
                label="Importer"
                tone="primary"
                onPress={() => {
                  const url = importUrl.trim();
                  const target = importFor;
                  if (!url.startsWith("http") || !target) {
                    Alert.alert("Lien invalide", "Collez l'adresse complète de l'annonce.");
                    return;
                  }
                  setImportFor(null);
                  void run(target.id, "importListingByUrl", [target.id, url], "Annonce importée.");
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

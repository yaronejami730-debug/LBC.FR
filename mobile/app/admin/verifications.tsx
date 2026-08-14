import { useCallback, useState } from "react";
import { View, Text, ScrollView, Alert, Modal, TextInput, Pressable, Image } from "react-native";
import { useFocusEffect } from "expo-router";
import { adminAction, adminData } from "@/lib/adminApi";
import { API_BASE_URL } from "@/lib/config";
import { getToken } from "@/lib/tokenStore";
import { ActionButton, Empty, Tabs } from "@/components/admin/AdminScreen";
import { colors } from "@/lib/theme";

type Log = { id: string; action: string; actor: string; details: string | null; createdAt: string };

type Verification = {
  id: string;
  status: string;
  requestType: string;
  submittedAt: string;
  siret: string;
  siren: string | null;
  siretPreviouslyBanned: boolean;
  companyName: string;
  commercialName: string | null;
  businessAddress: string | null;
  businessActivity: string | null;
  responsibleFirstName: string | null;
  responsibleLastName: string | null;
  professionalPhone: string | null;
  professionalEmail: string | null;
  idDocumentType: string;
  idDocumentPath: string;
  idDocumentBackPath: string | null;
  companyDocType: string;
  companyDocPath: string;
  documentsDeletedAt: string | null;
  adminNote: string | null;
  infoRequest: string | null;
  rejectionReason: string | null;
  logs: Log[];
  user: {
    id: string;
    email: string;
    name: string;
    createdAt: string;
    isPro: boolean;
    phoneNumber: string | null;
    emailVerified: boolean;
    phoneVerified: boolean;
    professionalStatus: string;
    _count: { listings: number };
  };
};

const TABS = [
  { value: "PENDING", label: "À vérifier" },
  { value: "INFO_REQUESTED", label: "Infos demandées" },
  { value: "APPROVED", label: "Vérifiés" },
  { value: "REJECTED", label: "Refusés" },
  { value: "SUSPENDED", label: "Suspendus" },
];

/**
 * Dossiers de vérification professionnelle, pièces comprises.
 *
 * Les documents vivent en blob privé : ils n'ont pas d'URL publique et ne
 * s'affichent qu'après contrôle du rôle, à travers la route du site. On les
 * charge donc à la demande, dossier par dossier, jamais dans la liste — une
 * pièce d'identité n'a rien à faire dans un cache de défilement.
 */
export default function AdminVerifications() {
  const [status, setStatus] = useState("PENDING");
  const [items, setItems] = useState<Verification[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [prompt, setPrompt] = useState<{
    item: Verification;
    action: "rejectVerification" | "requestVerificationInfo" | "suspendVerification" | "updateVerificationNote";
    title: string;
  } | null>(null);
  const [reason, setReason] = useState("");

  /** Dossier dont on regarde les pièces, et les images déjà téléchargées. */
  const [docsFor, setDocsFor] = useState<Verification | null>(null);
  const [docs, setDocs] = useState<{ label: string; uri: string }[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const load = useCallback(async (nextStatus: string) => {
    setLoading(true);
    try {
      setError(null);
      const data = await adminData<{ requests: Verification[]; counts: Record<string, number> }>(
        "verifications",
        { statut: nextStatus },
      );
      setItems(data.requests);
      setCounts(data.counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(status);
    }, [load, status]),
  );

  async function run(item: Verification, name: string, args: unknown[]) {
    setBusyId(item.id);
    try {
      await adminAction(name, ...args);
      await load(status);
    } catch (e) {
      Alert.alert("Action impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setBusyId(null);
    }
  }

  /**
   * Récupère les pièces en tant qu'images affichables.
   *
   * La route les sert authentifiées : on ne peut pas simplement pointer une
   * balise Image dessus, il faut passer le jeton et convertir la réponse.
   */
  async function openDocuments(item: Verification) {
    setDocsFor(item);
    setDocs([]);
    if (item.documentsDeletedAt) return;

    setDocsLoading(true);
    const token = await getToken();
    const wanted = [
      { label: `Pièce d'identité (${item.idDocumentType})`, path: item.idDocumentPath },
      ...(item.idDocumentBackPath
        ? [{ label: "Pièce d'identité — verso", path: item.idDocumentBackPath }]
        : []),
      { label: `Justificatif (${item.companyDocType})`, path: item.companyDocPath },
    ];

    const loaded: { label: string; uri: string }[] = [];
    for (const doc of wanted) {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/admin/pro-verification/document?path=${encodeURIComponent(doc.path)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
        );
        if (!res.ok) continue;
        const blob = await res.blob();
        const uri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        loaded.push({ label: doc.label, uri });
      } catch {
        // Une pièce illisible ne doit pas masquer les autres.
      }
    }
    setDocs(loaded);
    setDocsLoading(false);
  }

  return (
    <View className="flex-1 bg-app">
      <View className="px-4 pt-4">
        <Tabs
          tabs={TABS.map((t) => ({ ...t, count: counts[t.value] ?? 0 }))}
          value={status}
          onChange={setStatus}
        />
      </View>

      {error && (
        <View className="mx-4 mb-2 bg-surface rounded-xl px-4 py-3">
          <Text className="text-danger text-sm">{error}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 12 }}>
        {items.length === 0 && !loading && <Empty label="Aucun dossier dans cette file." />}

        {items.map((v) => (
          <View key={v.id} className="bg-surface rounded-xl p-4 mb-2">
            <Text className="text-on-surface font-bold">{v.commercialName || v.companyName}</Text>
            <Text className="text-on-surface-variant text-xs mt-0.5">
              {v.companyName} · SIRET {v.siret}
              {v.businessActivity ? ` · ${v.businessActivity}` : ""}
            </Text>
            {v.businessAddress && (
              <Text className="text-on-surface-variant text-xs mt-0.5">{v.businessAddress}</Text>
            )}

            <Text className="text-on-surface-variant text-xs mt-2">
              Responsable : {v.responsibleFirstName ?? "—"} {v.responsibleLastName ?? ""}
              {v.professionalPhone ? ` · ${v.professionalPhone}` : ""}
            </Text>
            <Text className="text-on-surface-variant text-xs mt-0.5">
              {v.user.name} · {v.user.email}
            </Text>
            <Text className="text-on-surface-variant text-xs mt-0.5">
              Compte du {new Date(v.user.createdAt).toLocaleDateString("fr-FR")} ·{" "}
              {v.user._count.listings} annonce{v.user._count.listings > 1 ? "s" : ""} · email{" "}
              {v.user.emailVerified ? "vérifié" : "non vérifié"} · téléphone{" "}
              {v.user.phoneVerified ? "vérifié" : "non vérifié"}
            </Text>
            <Text className="text-on-surface-variant text-[11px] mt-0.5">
              Déposé le {new Date(v.submittedAt).toLocaleDateString("fr-FR")} · {v.requestType}
            </Text>

            {v.siretPreviouslyBanned && (
              <Text className="text-xs mt-2" style={{ color: colors.danger }}>
                Ce SIRET a déjà servi à un compte banni. Un SIRET est public : c&apos;est souvent
                l&apos;entreprise réelle qui arrive ensuite. À examiner, pas à refuser d&apos;office.
              </Text>
            )}
            {v.infoRequest && (
              <Text className="text-on-surface-variant text-xs mt-2 italic">
                Demande en cours : {v.infoRequest}
              </Text>
            )}
            {v.rejectionReason && (
              <Text className="text-on-surface-variant text-xs mt-2 italic">
                Motif de refus : {v.rejectionReason}
              </Text>
            )}
            {v.adminNote && (
              <Text className="text-on-surface-variant text-xs mt-2 italic">Note : {v.adminNote}</Text>
            )}

            <Pressable onPress={() => openDocuments(v)} className="mt-3">
              <Text className="text-primary font-bold text-sm">
                {v.documentsDeletedAt ? "Pièces supprimées — voir le détail" : "Voir les pièces"}
              </Text>
            </Pressable>

            <View className="flex-row mt-3">
              {(v.status === "PENDING" || v.status === "INFO_REQUESTED") && (
                <ActionButton
                  label="Habiliter"
                  tone="primary"
                  disabled={busyId === v.id}
                  onPress={() => run(v, "approveVerification", [v.id])}
                />
              )}
              {v.status === "SUSPENDED" ? (
                <ActionButton
                  label="Rétablir"
                  tone="primary"
                  disabled={busyId === v.id}
                  onPress={() => run(v, "reinstateVerification", [v.id])}
                />
              ) : (
                <ActionButton
                  label="Suspendre"
                  disabled={busyId === v.id}
                  onPress={() => {
                    setReason("");
                    setPrompt({ item: v, action: "suspendVerification", title: "Suspendre l'habilitation" });
                  }}
                />
              )}
              <ActionButton
                label="Refuser"
                tone="danger"
                disabled={busyId === v.id}
                onPress={() => {
                  setReason("");
                  setPrompt({ item: v, action: "rejectVerification", title: "Refuser le dossier" });
                }}
              />
            </View>

            <View className="flex-row mt-2">
              <ActionButton
                label="Demander une pièce"
                disabled={busyId === v.id}
                onPress={() => {
                  setReason("");
                  setPrompt({
                    item: v,
                    action: "requestVerificationInfo",
                    title: "Demander une information",
                  });
                }}
              />
              <ActionButton
                label="Note interne"
                disabled={busyId === v.id}
                onPress={() => {
                  setReason(v.adminNote ?? "");
                  setPrompt({ item: v, action: "updateVerificationNote", title: "Note interne" });
                }}
              />
              <ActionButton
                label="Compte ouvert"
                disabled={busyId === v.id}
                onPress={() => run(v, "markCompteOpened", [v.id])}
              />
            </View>

            {v.logs.length > 0 && (
              <View className="mt-3">
                <Text className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
                  Historique
                </Text>
                {v.logs.slice(0, 5).map((log) => (
                  <Text key={log.id} className="text-on-surface-variant text-[11px] mt-0.5">
                    {new Date(log.createdAt).toLocaleDateString("fr-FR")} · {log.action}
                    {log.details ? ` — ${log.details}` : ""}
                  </Text>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Pièces justificatives */}
      <Modal visible={docsFor !== null} animationType="slide" onRequestClose={() => setDocsFor(null)}>
        <ScrollView className="flex-1 bg-app" contentContainerStyle={{ padding: 16 }}>
          <Text className="text-on-surface text-xl font-extrabold mb-1">Pièces justificatives</Text>
          <Text className="text-on-surface-variant text-xs mb-3">
            {docsFor?.commercialName || docsFor?.companyName}
          </Text>

          {docsFor?.documentsDeletedAt ? (
            <View className="bg-surface rounded-xl p-4">
              <Text className="text-on-surface-variant text-sm leading-5">
                Pièces supprimées le{" "}
                {new Date(docsFor.documentsDeletedAt).toLocaleDateString("fr-FR")}, conformément à la
                durée de conservation. La décision et son historique restent consultables.
              </Text>
            </View>
          ) : docsLoading ? (
            <Text className="text-on-surface-variant text-sm">Chargement des pièces…</Text>
          ) : docs.length === 0 ? (
            <Text className="text-on-surface-variant text-sm">
              Aucune pièce lisible. Ouvrez le dossier depuis le site.
            </Text>
          ) : (
            docs.map((doc) => (
              <View key={doc.label} className="mb-4">
                <Text className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider mb-1.5">
                  {doc.label}
                </Text>
                <Image
                  source={{ uri: doc.uri }}
                  style={{ width: "100%", height: 320, borderRadius: 12 }}
                  resizeMode="contain"
                />
              </View>
            ))
          )}

          <View className="flex-row mt-2">
            <ActionButton label="Fermer" onPress={() => setDocsFor(null)} />
          </View>
        </ScrollView>
      </Modal>

      {/* Motif / note */}
      <Modal visible={prompt !== null} transparent animationType="slide" onRequestClose={() => setPrompt(null)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.35)" }}>
          <View className="bg-surface rounded-t-2xl p-5">
            <Text className="text-on-surface font-bold text-base">{prompt?.title}</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Texte transmis au professionnel, ou note interne"
              placeholderTextColor={colors.outline}
              multiline
              className="mt-3 rounded-xl px-3 py-3 text-on-surface"
              style={{ backgroundColor: colors.surfaceContainer, minHeight: 100 }}
            />
            <View className="flex-row mt-4">
              <ActionButton label="Annuler" onPress={() => setPrompt(null)} />
              <ActionButton
                label="Confirmer"
                tone={prompt?.action === "rejectVerification" ? "danger" : "primary"}
                onPress={() => {
                  const text = reason.trim();
                  // La note interne peut être vidée ; les décisions, non.
                  if (prompt?.action !== "updateVerificationNote" && text.length < 5) {
                    Alert.alert("Motif requis", "Cinq caractères au minimum.");
                    return;
                  }
                  const target = prompt;
                  setPrompt(null);
                  if (target) void run(target.item, target.action, [target.item.id, text]);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

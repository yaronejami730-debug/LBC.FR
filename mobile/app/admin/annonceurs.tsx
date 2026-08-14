import { useCallback, useState } from "react";
import { View, Text, ScrollView, Alert, Linking, Pressable, Modal, TextInput } from "react-native";
import { useFocusEffect } from "expo-router";
import { adminAction, adminData } from "@/lib/adminApi";
import { ActionButton, Empty, Tabs } from "@/components/admin/AdminScreen";
import { colors } from "@/lib/theme";

type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  budget: string;
  company: string | null;
  message: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  contactedAt: string | null;
  createdAt: string;
};

/** Pipeline commercial, dans l'ordre du site. */
const STATUSES = [
  { value: "NEW", label: "Nouveaux" },
  { value: "CONTACTED", label: "Contactés" },
  { value: "QUALIFIED", label: "Qualifiés" },
  { value: "WON", label: "Gagnés" },
  { value: "LOST", label: "Perdus" },
];

/**
 * Annonceurs — les demandes déposées depuis la page d'accueil.
 *
 * L'intérêt du mobile est ici évident : un prospect se rappelle en marchant,
 * et le statut se met à jour dans la foulée plutôt qu'au retour au bureau.
 */
export default function AdminAnnonceurs() {
  const [status, setStatus] = useState("NEW");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  /** Notes internes de l'équipe commerciale, éditables comme sur le site. */
  const [noteFor, setNoteFor] = useState<Lead | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const data = await adminData<{ leads: Lead[]; counts: Record<string, number> }>("annonceurs");
      setLeads(data.leads);
      setCounts(data.counts);
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

  async function advance(lead: Lead, next: string) {
    setBusyId(lead.id);
    try {
      await adminAction("updateLeadStatus", lead.id, next);
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: next } : l)));
    } catch (e) {
      Alert.alert("Action impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setBusyId(null);
    }
  }

  async function run(lead: Lead, name: string, args: unknown[]) {
    setBusyId(lead.id);
    try {
      await adminAction(name, ...args);
      await load();
    } catch (e) {
      Alert.alert("Action impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setBusyId(null);
    }
  }

  const shown = leads.filter((l) => l.status === status);

  return (
    <View className="flex-1 bg-app">
      <View className="px-4 pt-4">
        <Tabs
          tabs={STATUSES.map((s) => ({ ...s, count: counts[s.value] ?? 0 }))}
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
        {shown.length === 0 && !loading && <Empty label="Aucune demande dans cette étape." />}

        {shown.map((lead) => (
          <View key={lead.id} className="bg-surface rounded-xl p-4 mb-2">
            <Text className="text-on-surface font-bold">
              {lead.firstName} {lead.lastName}
              {lead.company ? ` · ${lead.company}` : ""}
            </Text>
            <Text className="text-on-surface-variant text-xs mt-0.5">
              Budget annoncé : {lead.budget}
              {lead.source ? ` · via ${lead.source}` : ""}
            </Text>
            {lead.message && (
              <Text className="text-on-surface-variant text-xs mt-1 italic">« {lead.message} »</Text>
            )}
            <Text className="text-on-surface-variant text-[11px] mt-1">
              Reçue le {new Date(lead.createdAt).toLocaleDateString("fr-FR")}
              {lead.contactedAt
                ? ` · contactée le ${new Date(lead.contactedAt).toLocaleDateString("fr-FR")}`
                : ""}
            </Text>

            <View className="flex-row mt-2">
              <Pressable onPress={() => Linking.openURL(`tel:${lead.phone}`)} className="mr-4">
                <Text className="text-primary font-semibold text-sm">{lead.phone}</Text>
              </Pressable>
              <Pressable onPress={() => Linking.openURL(`mailto:${lead.email}`)}>
                <Text className="text-primary font-semibold text-sm">{lead.email}</Text>
              </Pressable>
            </View>

            {lead.notes && (
              <Text className="text-on-surface-variant text-xs mt-2 italic">Note : {lead.notes}</Text>
            )}

            <View className="flex-row mt-3">
              <ActionButton
                label="Note"
                disabled={busyId === lead.id}
                onPress={() => {
                  setNote(lead.notes ?? "");
                  setNoteFor(lead);
                }}
              />
              <ActionButton
                label="Supprimer"
                tone="danger"
                disabled={busyId === lead.id}
                onPress={() =>
                  Alert.alert("Supprimer la demande", `${lead.firstName} ${lead.lastName}`, [
                    { text: "Annuler", style: "cancel" },
                    {
                      text: "Supprimer",
                      style: "destructive",
                      onPress: () => run(lead, "deleteLead", [lead.id]),
                    },
                  ])
                }
              />
            </View>

            <View className="flex-row mt-2">
              {STATUSES.filter((s) => s.value !== lead.status)
                .slice(0, 3)
                .map((s) => (
                  <ActionButton
                    key={s.value}
                    label={s.label}
                    tone={s.value === "WON" ? "primary" : s.value === "LOST" ? "danger" : "neutral"}
                    disabled={busyId === lead.id}
                    onPress={() => advance(lead, s.value)}
                  />
                ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={noteFor !== null} transparent animationType="slide" onRequestClose={() => setNoteFor(null)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.35)" }}>
          <View className="bg-surface rounded-t-2xl p-5">
            <Text className="text-on-surface font-bold text-base">Note interne</Text>
            <Text className="text-on-surface-variant text-xs mt-1">
              {noteFor?.firstName} {noteFor?.lastName}
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Ce qu'il faut savoir avant de rappeler"
              placeholderTextColor={colors.outline}
              multiline
              className="mt-3 rounded-xl px-3 py-3 text-on-surface"
              style={{ backgroundColor: colors.surfaceContainer, minHeight: 100 }}
            />
            <View className="flex-row mt-4">
              <ActionButton label="Annuler" onPress={() => setNoteFor(null)} />
              <ActionButton
                label="Enregistrer"
                tone="primary"
                onPress={() => {
                  const target = noteFor;
                  setNoteFor(null);
                  if (target) void run(target, "updateLeadNotes", [target.id, note]);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Le compteur global reste visible : c'est lui qu'on regarde en fin de
          semaine, pas le détail d'une étape. */}
      <View className="px-4 py-3" style={{ borderTopWidth: 1, borderTopColor: colors.line }}>
        <Text className="text-on-surface-variant text-xs">
          {Object.entries(counts)
            .map(([k, v]) => `${STATUSES.find((s) => s.value === k)?.label ?? k} ${v}`)
            .join(" · ")}
        </Text>
      </View>
    </View>
  );
}

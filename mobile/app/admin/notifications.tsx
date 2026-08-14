import { useCallback, useState } from "react";
import { View, Text, ScrollView, TextInput, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { adminAction, adminData } from "@/lib/adminApi";
import { ActionButton, Tabs } from "@/components/admin/AdminScreen";
import { colors } from "@/lib/theme";

type Audiences = {
  pushAudience: number;
  emailAudience: number;
  pro: number;
  particuliers: number;
};

const TABS = [
  { value: "push", label: "Notification push" },
  { value: "email", label: "Campagne email" },
];

const AUDIENCES = [
  { value: "all", label: "Tout le monde" },
  { value: "pro", label: "Professionnels" },
  { value: "particuliers", label: "Particuliers" },
];

const input = { backgroundColor: colors.surfaceContainer } as const;

/**
 * Envois de masse — push et email, comme sur le site.
 *
 * Un envoi part à des milliers de personnes et ne se rattrape pas : d'où la
 * confirmation qui rappelle le nombre exact de destinataires avant l'envoi,
 * plutôt qu'un bouton qui déclenche au premier appui.
 */
export default function AdminNotifications() {
  const [tab, setTab] = useState("push");
  const [audiences, setAudiences] = useState<Audiences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const data = await adminData<{ audiences: Audiences }>("notifications");
      setAudiences(data.audiences);
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

  function confirmPush() {
    const count = audiences?.pushAudience ?? 0;
    Alert.alert(
      "Envoyer la notification",
      `Elle partira sur ${count} appareil${count > 1 ? "s" : ""}. Impossible de la rappeler.`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Envoyer", onPress: sendPush },
      ],
    );
  }

  async function sendPush() {
    setSending(true);
    try {
      const result = await adminAction<{ sent?: number } | null>("sendBroadcastPush", {
        title,
        body,
        link: link || undefined,
      });
      setTitle("");
      setBody("");
      setLink("");
      Alert.alert("Envoyée", result?.sent ? `${result.sent} appareils touchés.` : "Notification partie.");
    } catch (e) {
      Alert.alert("Envoi impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setSending(false);
    }
  }

  function confirmEmail() {
    const count =
      audience === "pro"
        ? (audiences?.pro ?? 0)
        : audience === "particuliers"
          ? (audiences?.particuliers ?? 0)
          : (audiences?.emailAudience ?? 0);
    Alert.alert(
      "Envoyer la campagne",
      `Environ ${count} destinataire${count > 1 ? "s" : ""}, parmi les comptes ayant accepté les emails.`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Envoyer", onPress: sendEmail },
      ],
    );
  }

  async function sendEmail() {
    setSending(true);
    try {
      await adminAction("sendCampaignEmail", { subject, message, audience });
      setSubject("");
      setMessage("");
      Alert.alert("Envoyée", "La campagne est partie.");
    } catch (e) {
      Alert.alert("Envoi impossible", e instanceof Error ? e.message : "Réessayez.");
    } finally {
      setSending(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-app" contentContainerStyle={{ padding: 16 }}>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {error && (
        <View className="bg-surface rounded-xl px-4 py-3 mb-3">
          <Text className="text-danger text-sm">{error}</Text>
        </View>
      )}

      {audiences && (
        <View className="bg-surface rounded-xl p-4 mb-3">
          <Text className="text-on-surface-variant text-xs">
            {audiences.pushAudience} appareils avec notifications · {audiences.emailAudience} comptes
            joignables par email ({audiences.pro} pro, {audiences.particuliers} particuliers)
          </Text>
        </View>
      )}

      {tab === "push" ? (
        <View className="bg-surface rounded-xl p-4">
          <Text className="text-on-surface font-bold mb-3">Notification push</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Titre (100 caractères max)"
            placeholderTextColor={colors.outline}
            className="rounded-xl px-3 py-3 text-on-surface mb-2"
            style={input}
          />
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Message (240 caractères max)"
            placeholderTextColor={colors.outline}
            multiline
            className="rounded-xl px-3 py-3 text-on-surface mb-2"
            style={{ ...input, minHeight: 90 }}
          />
          <TextInput
            value={link}
            onChangeText={setLink}
            placeholder="Lien d'ouverture (optionnel), ex. /annonces/vehicules"
            placeholderTextColor={colors.outline}
            autoCapitalize="none"
            className="rounded-xl px-3 py-3 text-on-surface mb-3"
            style={input}
          />
          <View className="flex-row">
            <ActionButton
              label={sending ? "Envoi…" : "Envoyer"}
              tone="primary"
              disabled={sending || title.trim().length < 2 || body.trim().length < 3}
              onPress={confirmPush}
            />
          </View>
        </View>
      ) : (
        <View className="bg-surface rounded-xl p-4">
          <Text className="text-on-surface font-bold mb-3">Campagne email</Text>
          <Tabs tabs={AUDIENCES} value={audience} onChange={setAudience} />
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="Sujet"
            placeholderTextColor={colors.outline}
            className="rounded-xl px-3 py-3 text-on-surface mb-2"
            style={input}
          />
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Message"
            placeholderTextColor={colors.outline}
            multiline
            className="rounded-xl px-3 py-3 text-on-surface mb-3"
            style={{ ...input, minHeight: 140 }}
          />
          <View className="flex-row">
            <ActionButton
              label={sending ? "Envoi…" : "Envoyer"}
              tone="primary"
              disabled={sending || subject.trim().length < 3 || message.trim().length < 10}
              onPress={confirmEmail}
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

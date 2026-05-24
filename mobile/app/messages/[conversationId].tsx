import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
  Alert,
  Linking,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { apiFetch } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";
import { getToken } from "@/lib/tokenStore";
import { useAuth } from "@/lib/auth";
import { firstImage, formatPrice, timeAgo } from "@/lib/format";

type Attachment = { url: string; type: "image" | "pdf"; name?: string | null };

type Message = {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  createdAt: string;
  flagged?: boolean;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  attachmentName?: string | null;
};

async function uploadFile(uri: string, name: string, mime: string): Promise<string> {
  const token = await getToken();
  const form = new FormData();
  // RN FormData accepte cet objet — typings TS imprécis ici.
  form.append("file", { uri, name, type: mime } as unknown as Blob);
  const res = await fetch(`${API_BASE_URL}/api/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data.url as string;
}

type Conversation = {
  id: string;
  updatedAt: string;
  listing: { id: string; title: string; price: number; images: string | string[] | null };
  participants: {
    userId: string;
    user: { id: string; name: string; avatar?: string | null; verified?: boolean; lastLoginAt: string | null };
  }[];
};

export default function ConversationScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const lastSeenRef = useRef<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const fetchMessages = useCallback(
    async (cursor?: string | null) => {
      if (!conversationId) return;
      const qs = new URLSearchParams({ conversationId });
      if (cursor) qs.set("after", cursor);
      const data = await apiFetch<Message[]>(`/api/messages?${qs.toString()}`);
      if (data.length > 0) {
        lastSeenRef.current = data[data.length - 1].id;
        setMessages((prev) => (cursor ? [...prev, ...data] : data));
      } else if (!cursor) {
        setMessages([]);
      }
    },
    [conversationId],
  );

  const fetchConv = useCallback(async () => {
    if (!conversationId) return;
    const data = await apiFetch<Conversation>(`/api/conversations/${conversationId}`);
    setConv(data);
  }, [conversationId]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await Promise.all([fetchConv(), fetchMessages()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchConv, fetchMessages]);

  useEffect(() => {
    const t = setInterval(() => {
      fetchMessages(lastSeenRef.current).catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [fetchMessages]);

  const send = async () => {
    const content = text.trim();
    if ((!content && !attachment) || sending || uploading) return;
    const sentAttachment = attachment;
    setSending(true);
    setText("");
    setAttachment(null);
    try {
      const msg = await apiFetch<Message>("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          conversationId,
          content,
          attachmentUrl: sentAttachment?.url,
          attachmentType: sentAttachment?.type,
          attachmentName: sentAttachment?.name,
        }),
      });
      setMessages((prev) => [...prev, msg]);
      lastSeenRef.current = msg.id;
    } catch (e) {
      setText(content);
      setAttachment(sentAttachment);
      setError(e instanceof Error ? e.message : "Échec de l'envoi");
    } finally {
      setSending(false);
    }
  };

  const handleImage = async (camera: boolean) => {
    const perm = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission refusée", camera ? "Autorisez l'appareil photo." : "Autorisez l'accès aux photos.");
      return;
    }
    const res = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.85,
        });
    if (res.canceled || res.assets.length === 0) return;
    const asset = res.assets[0];
    setUploading(true);
    setError(null);
    try {
      const ext = asset.uri.split(".").pop()?.toLowerCase() ?? "jpg";
      const mime = ext === "png" ? "image/png" : "image/jpeg";
      const url = await uploadFile(asset.uri, `photo.${ext}`, mime);
      setAttachment({ url, type: "image" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload échoué");
    } finally {
      setUploading(false);
    }
  };

  const handlePdf = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
    if (res.canceled || res.assets.length === 0) return;
    const asset = res.assets[0];
    setUploading(true);
    setError(null);
    try {
      const url = await uploadFile(asset.uri, asset.name ?? "document.pdf", "application/pdf");
      setAttachment({ url, type: "pdf", name: asset.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload échoué");
    } finally {
      setUploading(false);
    }
  };

  const openAttachMenu = () => {
    if (uploading || sending) return;
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Annuler", "Galerie", "Appareil photo", "Fichier PDF"],
          cancelButtonIndex: 0,
        },
        (i) => {
          if (i === 1) handleImage(false);
          else if (i === 2) handleImage(true);
          else if (i === 3) handlePdf();
        },
      );
    } else {
      Alert.alert("Joindre", undefined, [
        { text: "Galerie", onPress: () => handleImage(false) },
        { text: "Appareil photo", onPress: () => handleImage(true) },
        { text: "Fichier PDF", onPress: handlePdf },
        { text: "Annuler", style: "cancel" },
      ]);
    }
  };

  if (!user) {
    return (
      <View className="flex-1 bg-surface items-center justify-center px-6">
        <Text className="text-on-surface text-center mb-4">Connectez-vous pour discuter.</Text>
        <Pressable onPress={() => router.push("/(auth)/login")} className="bg-primary px-6 py-3 rounded-full">
          <Text className="text-white font-bold">Se connecter</Text>
        </Pressable>
      </View>
    );
  }

  const other = conv?.participants.find((p) => p.userId !== user.id)?.user;
  const listingImg = conv ? firstImage(conv.listing.images) : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
      style={{ flex: 1 }}
      className="bg-surface"
    >
      <Stack.Screen
        options={{
          headerBackTitle: "Retour",
          headerTitleAlign: "left",
          headerTitle: () => (
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-surface-container overflow-hidden mr-2">
                {other?.avatar && (
                  <Image source={{ uri: other.avatar }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                )}
              </View>
              <View>
                <Text className="text-on-surface font-bold text-base" numberOfLines={1}>
                  {other?.name ?? "Utilisateur"}
                </Text>
                <Text className="text-on-surface-variant text-xs" numberOfLines={1}>
                  {other?.lastLoginAt ? `Dernière activité ${timeAgo(other.lastLoginAt)}` : "Hors ligne"}
                </Text>
              </View>
            </View>
          ),
        }}
      />

      {conv && (
        <View className="border-b border-surface-container bg-surface">
          <Pressable
            onPress={() => router.push(`/annonce/${conv.listing.id}`)}
            className="flex-row items-center px-4 py-2 bg-surface-container-low active:opacity-70"
          >
            <View className="w-11 h-11 rounded-md bg-surface-container overflow-hidden mr-3">
              {listingImg && (
                <Image source={{ uri: listingImg }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-on-surface font-semibold text-sm" numberOfLines={1}>
                {conv.listing.title}
              </Text>
              <Text className="text-primary text-sm font-bold">{formatPrice(conv.listing.price)}</Text>
            </View>
            <Text className="text-on-surface-variant text-xs ml-2">›</Text>
          </Pressable>
        </View>
      )}

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#2f6fb8" /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <Text className="text-on-surface-variant text-center mt-12">Commencez la discussion.</Text>
          }
          renderItem={({ item }) => {
            const mine = item.senderId === user.id;
            const attUrl = item.attachmentUrl
              ? item.attachmentUrl.startsWith("http")
                ? item.attachmentUrl
                : `${API_BASE_URL}${item.attachmentUrl}`
              : null;
            const isImg = item.attachmentType === "image" && attUrl;
            const isPdf = item.attachmentType === "pdf" && attUrl;
            return (
              <View className={`my-1 max-w-[80%] ${mine ? "self-end" : "self-start"}`}>
                {isImg && (
                  <Pressable onPress={() => Linking.openURL(attUrl)} className="mb-1 rounded-2xl overflow-hidden">
                    <Image
                      source={{ uri: attUrl }}
                      style={{ width: 220, height: 220 }}
                      contentFit="cover"
                    />
                  </Pressable>
                )}
                {isPdf && (
                  <Pressable
                    onPress={() => Linking.openURL(attUrl)}
                    className={`flex-row items-center mb-1 px-3 py-2 rounded-2xl ${mine ? "bg-primary" : "bg-surface-container"}`}
                  >
                    <Ionicons name="document-text-outline" size={22} color={mine ? "#ffffff" : "#2f6fb8"} />
                    <Text className={`ml-2 max-w-[160px] ${mine ? "text-white" : "text-on-surface"}`} numberOfLines={1}>
                      {item.attachmentName ?? "Document.pdf"}
                    </Text>
                  </Pressable>
                )}
                {!!item.content && (
                  <View
                    className={`px-3 py-2 rounded-2xl ${mine ? "bg-primary rounded-br-sm" : "bg-surface-container rounded-bl-sm"}`}
                  >
                    <Text className={mine ? "text-white" : "text-on-surface"}>{item.content}</Text>
                  </View>
                )}
                <Text className={`text-[10px] mt-0.5 ${mine ? "text-right text-on-surface-variant" : "text-on-surface-variant"}`}>
                  {timeAgo(item.createdAt)}
                  {item.flagged ? " · signalé" : ""}
                </Text>
              </View>
            );
          }}
        />
      )}

      {error && (
        <View className="px-3 py-2 bg-red-50 border-t border-red-200">
          <Text className="text-red-700 text-xs">{error}</Text>
        </View>
      )}

      {(attachment || uploading) && (
        <View className="flex-row items-center px-3 py-2 border-t border-surface-container bg-surface-container-low">
          {uploading ? (
            <>
              <ActivityIndicator color="#2f6fb8" />
              <Text className="text-on-surface-variant text-sm ml-2">Envoi du fichier…</Text>
            </>
          ) : attachment ? (
            <>
              {attachment.type === "image" ? (
                <Image
                  source={{ uri: attachment.url.startsWith("http") ? attachment.url : `${API_BASE_URL}${attachment.url}` }}
                  style={{ width: 40, height: 40, borderRadius: 6 }}
                  contentFit="cover"
                />
              ) : (
                <Ionicons name="document-text-outline" size={28} color="#2f6fb8" />
              )}
              <Text className="text-on-surface text-sm ml-2 flex-1" numberOfLines={1}>
                {attachment.type === "pdf" ? attachment.name ?? "Document.pdf" : "Photo prête à envoyer"}
              </Text>
              <Pressable onPress={() => setAttachment(null)} className="ml-2">
                <Ionicons name="close-circle" size={22} color="#94a3b8" />
              </Pressable>
            </>
          ) : null}
        </View>
      )}

      <View
        className="flex-row items-end gap-2 p-2 border-t border-surface-container bg-surface"
        style={{ paddingBottom: Math.max(8, insets.bottom) }}
      >
        <Pressable
          onPress={openAttachMenu}
          disabled={uploading || sending}
          className="w-10 h-10 rounded-full border border-primary items-center justify-center"
        >
          <Ionicons name="add" size={24} color="#2f6fb8" />
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Votre message…"
          placeholderTextColor="#94a3b8"
          multiline
          className="flex-1 bg-surface-container rounded-2xl px-3 py-2 text-on-surface max-h-32"
        />
        <Pressable
          onPress={send}
          disabled={sending || uploading || (!text.trim() && !attachment)}
          className={`px-4 py-2.5 rounded-full ${sending || uploading || (!text.trim() && !attachment) ? "bg-surface-container" : "bg-primary"}`}
        >
          <Text className={`font-bold ${sending || uploading || (!text.trim() && !attachment) ? "text-outline" : "text-white"}`}>Envoyer</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

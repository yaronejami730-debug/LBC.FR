import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/config";
import { getToken } from "@/lib/tokenStore";
import { apiFetch } from "@/lib/api";
import { CATEGORIES, CONDITIONS } from "@/lib/categories";

type CategoryDef = (typeof CATEGORIES)[number];

async function uploadImageAsync(uri: string): Promise<string> {
  const token = await getToken();
  const form = new FormData();
  const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const mime = ext === "png" ? "image/png" : "image/jpeg";
  // RN FormData accepte cet objet — typings TS imprécis ici.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form.append("file", { uri, name: `upload.${ext}`, type: mime } as any);
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

export default function PostScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<CategoryDef | null>(null);
  const [subcategory, setSubcategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [condition, setCondition] = useState<string>("Bon état");
  const [phone, setPhone] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [hidePhone, setHidePhone] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-on-surface text-xl font-bold mb-2">Publier une annonce</Text>
          <Text className="text-on-surface-variant text-sm mb-6 text-center">Connectez-vous pour publier.</Text>
          <Pressable onPress={() => router.push("/(auth)/login")} className="bg-primary px-6 py-3 rounded-full">
            <Text className="text-white font-bold">Se connecter</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!user.emailVerified) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-on-surface text-xl font-bold mb-2">Email non vérifié</Text>
          <Text className="text-on-surface-variant text-sm mb-6 text-center">
            Vérifiez votre adresse email avant de publier une annonce.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission refusée", "Autorisez l'accès aux photos pour ajouter des images.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: 8 - images.length,
    });
    if (res.canceled || res.assets.length === 0) return;
    setUploadingImg(true);
    try {
      const uploads = await Promise.all(res.assets.map((a) => uploadImageAsync(a.uri)));
      setImages((prev) => [...prev, ...uploads]);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Upload échoué");
    } finally {
      setUploadingImg(false);
    }
  };

  const removeImage = (url: string) => setImages((prev) => prev.filter((u) => u !== url));

  const fillFromGPS = async () => {
    setGeoLoading(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission refusée", "Autorisez la localisation pour utiliser votre position.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const places = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const p = places[0];
      if (!p) {
        Alert.alert("Erreur", "Impossible de déterminer la ville.");
        return;
      }
      const city = p.city ?? p.subregion ?? p.region ?? "";
      const postal = p.postalCode ? ` ${p.postalCode}` : "";
      setLocation(`${city}${postal}`.trim());
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Géolocalisation échouée");
    } finally {
      setGeoLoading(false);
    }
  };

  const submit = async () => {
    setError(null);
    if (!title.trim() || !price || !category || !description.trim() || !location.trim()) {
      setError("Tous les champs marqués sont obligatoires.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await apiFetch<{ id: string; status: string; rejectionReason?: string | null }>(
        "/api/listings",
        {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            price: parseFloat(price.replace(",", ".")),
            category: category.label,
            subcategory: subcategory || null,
            description: description.trim(),
            location: location.trim(),
            condition,
            images,
            metadata: {},
            phone: phone.trim() || null,
            hidePhone,
          }),
        },
      );
      if (created.status === "REJECTED") {
        Alert.alert("Annonce refusée", created.rejectionReason ?? "Annonce refusée par la modération.");
      } else if (created.status === "PENDING") {
        Alert.alert("En attente de validation", "Votre annonce sera publiée après vérification.");
      } else {
        Alert.alert("Annonce publiée", "Votre annonce est en ligne !");
      }
      router.replace(`/annonce/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la publication");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          <Text className="text-on-surface text-2xl font-extrabold mb-4">Publier une annonce</Text>

          <Label>Photos (jusqu'à 8)</Label>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {images.map((url) => (
              <View key={url} className="w-20 h-20 bg-surface-container rounded-lg overflow-hidden relative">
                <Image source={{ uri: url }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                <Pressable
                  onPress={() => removeImage(url)}
                  className="absolute top-0.5 right-0.5 bg-black/60 rounded-full w-5 h-5 items-center justify-center"
                >
                  <Text className="text-white text-xs">×</Text>
                </Pressable>
              </View>
            ))}
            {images.length < 8 && (
              <Pressable
                onPress={pickImage}
                disabled={uploadingImg}
                className="w-20 h-20 border-2 border-dashed border-outline rounded-lg items-center justify-center"
              >
                {uploadingImg ? <ActivityIndicator color="#2f6fb8" /> : <Text className="text-outline text-2xl">+</Text>}
              </Pressable>
            )}
          </View>

          <Label required>Titre</Label>
          <Field value={title} onChangeText={setTitle} placeholder="ex : iPhone 14 Pro 256 Go" maxLength={200} />

          <Label required>Prix (€)</Label>
          <Field value={price} onChangeText={setPrice} placeholder="0" keyboardType="decimal-pad" />

          <Label required>Catégorie</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
            {CATEGORIES.map((c) => {
              const active = category?.id === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    setCategory(c);
                    setSubcategory("");
                  }}
                  className={`px-3 py-1.5 rounded-full mr-2 ${active ? "bg-primary" : "bg-surface-container"}`}
                >
                  <Text className={`text-sm font-semibold ${active ? "text-white" : "text-on-surface-variant"}`}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {category && category.subcategories.length > 0 && (
            <>
              <Label>Sous-catégorie</Label>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
                {category.subcategories.map((s) => {
                  const active = subcategory === s;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setSubcategory(s)}
                      className={`px-3 py-1.5 rounded-full mr-2 ${active ? "bg-primary" : "bg-surface-container"}`}
                    >
                      <Text className={`text-sm font-semibold ${active ? "text-white" : "text-on-surface-variant"}`}>{s}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}

          <Label>État</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
            {CONDITIONS.map((c) => {
              const active = condition === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCondition(c)}
                  className={`px-3 py-1.5 rounded-full mr-2 ${active ? "bg-primary" : "bg-surface-container"}`}
                >
                  <Text className={`text-sm font-semibold ${active ? "text-white" : "text-on-surface-variant"}`}>{c}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Label required>Description</Label>
          <Field
            value={description}
            onChangeText={setDescription}
            placeholder="Décrivez votre article (état, dimensions, etc.)"
            multiline
            maxLength={10000}
            style={{ minHeight: 120, textAlignVertical: "top" }}
          />

          <Label required>Localisation</Label>
          <View className="flex-row gap-2 mb-2">
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="ex : Paris 75011"
              placeholderTextColor="#94a3b8"
              className="flex-1 bg-surface-container rounded-lg px-3 py-2.5 text-on-surface"
            />
            <Pressable
              onPress={fillFromGPS}
              disabled={geoLoading}
              className={`px-3 rounded-lg justify-center ${geoLoading ? "bg-outline" : "bg-primary"}`}
            >
              {geoLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-xs">📍 GPS</Text>
              )}
            </Pressable>
          </View>

          <Label>Téléphone (optionnel)</Label>
          <Field value={phone} onChangeText={setPhone} placeholder="06 12 34 56 78" keyboardType="phone-pad" />
          {phone.trim() && (
            <Pressable
              onPress={() => setHidePhone((v) => !v)}
              className="flex-row items-center mb-3"
            >
              <View className={`w-5 h-5 rounded border-2 mr-2 items-center justify-center ${hidePhone ? "bg-primary border-primary" : "border-outline"}`}>
                {hidePhone && <Text className="text-white text-xs">✓</Text>}
              </View>
              <Text className="text-on-surface text-sm">Masquer mon numéro publiquement</Text>
            </Pressable>
          )}

          {error && (
            <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
              <Text className="text-red-700 text-sm">{error}</Text>
            </View>
          )}

          <Pressable
            onPress={submit}
            disabled={submitting}
            className={`py-3.5 rounded-full items-center mt-2 ${submitting ? "bg-outline" : "bg-primary"}`}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold">Publier mon annonce</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Text className="text-on-surface text-sm font-semibold mb-1.5 mt-2">
      {children}
      {required && <Text className="text-red-600"> *</Text>}
    </Text>
  );
}

function Field(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="#94a3b8"
      className="bg-surface-container rounded-lg px-3 py-2.5 text-on-surface mb-2"
    />
  );
}

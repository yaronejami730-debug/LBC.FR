import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
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
  const [step, setStep] = useState(0);

  const STEPS = ["Titre", "Photos", "Catégorie", "Détails", "Récap"];
  const TOTAL = STEPS.length;

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

  const uploadAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    if (assets.length === 0) return;
    setUploadingImg(true);
    try {
      const uploads = await Promise.all(assets.map((a) => uploadImageAsync(a.uri)));
      setImages((prev) => [...prev, ...uploads]);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Upload échoué");
    } finally {
      setUploadingImg(false);
    }
  };

  const pickFromLibrary = async () => {
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
    if (res.canceled) return;
    await uploadAssets(res.assets);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission refusée", "Autorisez l'appareil photo pour prendre une photo.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (res.canceled) return;
    await uploadAssets(res.assets);
  };

  const addPhoto = () => {
    if (uploadingImg) return;
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Annuler", "Prendre une photo", "Choisir dans la galerie"], cancelButtonIndex: 0 },
        (i) => {
          if (i === 1) takePhoto();
          else if (i === 2) pickFromLibrary();
        },
      );
    } else {
      Alert.alert("Ajouter une photo", undefined, [
        { text: "Prendre une photo", onPress: takePhoto },
        { text: "Choisir dans la galerie", onPress: pickFromLibrary },
        { text: "Annuler", style: "cancel" },
      ]);
    }
  };

  const removeImage = (url: string) => setImages((prev) => prev.filter((u) => u !== url));

  // L'upload local renvoie une URL relative (/uploads/..). Préfixe l'host pour l'aperçu.
  const displayUri = (u: string) => (u.startsWith("http") ? u : `${API_BASE_URL}${u}`);

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

  const stepError = (s: number): string | null => {
    if (s === 0) {
      if (!title.trim()) return "Indiquez un titre.";
      if (!price) return "Indiquez un prix.";
    }
    if (s === 1 && images.length === 0) return "Ajoutez au moins une photo.";
    if (s === 2 && !category) return "Choisissez une catégorie.";
    if (s === 3) {
      if (!description.trim()) return "Ajoutez une description.";
      if (!location.trim()) return "Indiquez la localisation.";
    }
    return null;
  };

  const next = () => {
    const err = stepError(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(TOTAL - 1, s + 1));
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
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
        {/* En-tête + progression */}
        <View className="px-4 pt-2 pb-3">
          <Text className="text-on-surface text-2xl font-extrabold">Publier une annonce</Text>
          <Text className="text-on-surface-variant text-xs mt-0.5">
            Étape {step + 1}/{TOTAL} · {STEPS[step]}
          </Text>
          <View className="flex-row gap-1 mt-2">
            {STEPS.map((_, i) => (
              <View
                key={i}
                className={`flex-1 h-1.5 rounded-full ${i <= step ? "bg-primary" : "bg-surface-container"}`}
              />
            ))}
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          {/* Étape 0 — Titre + prix */}
          {step === 0 && (
            <>
              <Label required>Titre</Label>
              <Field value={title} onChangeText={setTitle} placeholder="ex : iPhone 14 Pro 256 Go" maxLength={200} />
              <Label required>Prix (€)</Label>
              <Field value={price} onChangeText={setPrice} placeholder="0" keyboardType="decimal-pad" />
            </>
          )}

          {/* Étape 1 — Photos */}
          {step === 1 && (
            <>
              <Label>Photos (jusqu'à 8)</Label>
              <View className="flex-row flex-wrap gap-2 mb-2">
                {images.map((url) => (
                  <View key={url} className="w-24 h-24 bg-surface-container rounded-lg overflow-hidden relative">
                    <Image source={{ uri: displayUri(url) }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
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
                    onPress={addPhoto}
                    disabled={uploadingImg}
                    className="w-24 h-24 border-2 border-dashed border-outline rounded-lg items-center justify-center"
                  >
                    {uploadingImg ? <ActivityIndicator color="#2f6fb8" /> : <Text className="text-outline text-3xl">+</Text>}
                  </Pressable>
                )}
              </View>
              <Text className="text-on-surface-variant text-xs">La première photo sera la principale.</Text>
            </>
          )}

          {/* Étape 2 — Catégorie + sous-catégorie + état */}
          {step === 2 && (
            <>
              <Label required>Catégorie</Label>
              <View className="flex-row flex-wrap gap-2 mb-2">
                {CATEGORIES.map((c) => {
                  const active = category?.id === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => {
                        setCategory(c);
                        setSubcategory("");
                      }}
                      className={`px-3 py-2 rounded-full ${active ? "bg-primary" : "bg-surface-container"}`}
                    >
                      <Text className={`text-sm font-semibold ${active ? "text-white" : "text-on-surface-variant"}`}>
                        {c.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {category && category.subcategories.length > 0 && (
                <>
                  <Label>Sous-catégorie</Label>
                  <View className="flex-row flex-wrap gap-2 mb-2">
                    {category.subcategories.map((s) => {
                      const active = subcategory === s;
                      return (
                        <Pressable
                          key={s}
                          onPress={() => setSubcategory(s)}
                          className={`px-3 py-2 rounded-full ${active ? "bg-primary" : "bg-surface-container"}`}
                        >
                          <Text className={`text-sm font-semibold ${active ? "text-white" : "text-on-surface-variant"}`}>{s}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              <Label>État</Label>
              <View className="flex-row flex-wrap gap-2 mb-2">
                {CONDITIONS.map((c) => {
                  const active = condition === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setCondition(c)}
                      className={`px-3 py-2 rounded-full ${active ? "bg-primary" : "bg-surface-container"}`}
                    >
                      <Text className={`text-sm font-semibold ${active ? "text-white" : "text-on-surface-variant"}`}>{c}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* Étape 3 — Description + localisation + téléphone */}
          {step === 3 && (
            <>
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
                  {geoLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-xs">📍 GPS</Text>}
                </Pressable>
              </View>

              <Label>Téléphone (optionnel)</Label>
              <Field value={phone} onChangeText={setPhone} placeholder="06 12 34 56 78" keyboardType="phone-pad" />
              {phone.trim() && (
                <Pressable onPress={() => setHidePhone((v) => !v)} className="flex-row items-center mb-3">
                  <View className={`w-5 h-5 rounded border-2 mr-2 items-center justify-center ${hidePhone ? "bg-primary border-primary" : "border-outline"}`}>
                    {hidePhone && <Text className="text-white text-xs">✓</Text>}
                  </View>
                  <Text className="text-on-surface text-sm">Masquer mon numéro publiquement</Text>
                </Pressable>
              )}
            </>
          )}

          {/* Étape 4 — Récapitulatif */}
          {step === 4 && (
            <View>
              {images[0] && (
                <Image source={{ uri: displayUri(images[0]) }} style={{ width: "100%", height: 180, borderRadius: 12 }} contentFit="cover" />
              )}
              <Text className="text-on-surface text-xl font-extrabold mt-3">{title || "Sans titre"}</Text>
              <Text className="text-primary text-lg font-extrabold mt-0.5">
                {price ? `${price} €` : "Prix non indiqué"}
              </Text>
              <RecapRow label="Catégorie" value={[category?.label, subcategory].filter(Boolean).join(" · ") || "—"} />
              <RecapRow label="État" value={condition} />
              <RecapRow label="Localisation" value={location || "—"} />
              <RecapRow label="Photos" value={`${images.length}`} />
              {phone.trim() ? <RecapRow label="Téléphone" value={hidePhone ? `${phone} (masqué)` : phone} /> : null}
              <Text className="text-on-surface-variant text-sm mt-3" numberOfLines={4}>
                {description}
              </Text>
            </View>
          )}

          {error && (
            <View className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
              <Text className="text-red-700 text-sm">{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Pied — navigation */}
        <View className="flex-row gap-2 px-4 py-3 border-t border-surface-container">
          {step > 0 && (
            <Pressable onPress={back} disabled={submitting} className="px-5 py-3.5 rounded-full bg-surface-container items-center justify-center">
              <Text className="text-on-surface font-bold">Précédent</Text>
            </Pressable>
          )}
          {step < TOTAL - 1 ? (
            <Pressable onPress={next} className="flex-1 py-3.5 rounded-full bg-primary items-center">
              <Text className="text-white font-bold">Suivant</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={submit}
              disabled={submitting}
              className={`flex-1 py-3.5 rounded-full items-center ${submitting ? "bg-outline" : "bg-primary"}`}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Publier mon annonce</Text>}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1.5 border-b border-surface-container">
      <Text className="text-on-surface-variant text-sm">{label}</Text>
      <Text className="text-on-surface text-sm font-semibold flex-1 text-right ml-3" numberOfLines={1}>{value}</Text>
    </View>
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

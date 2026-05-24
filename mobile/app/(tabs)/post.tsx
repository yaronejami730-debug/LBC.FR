import { useEffect, useRef, useState } from "react";
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
  AppState,
  type AppStateStatus,
} from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/config";
import { getToken } from "@/lib/tokenStore";
import { apiFetch } from "@/lib/api";
import { CATEGORIES, CONDITIONS } from "@/lib/categories";
import { getPhotoTemplate, type PhotoSlot } from "@/lib/photoTemplates";
import { MapLocationPicker, type LocationValue } from "@/components/MapLocationPicker";

type CategoryDef = (typeof CATEGORIES)[number];
type SlotPhoto = { slotKey: string | null; url: string };

const DRAFT_REMINDER_KEY = "dealandco.draft.lastReminderAt";

async function uploadImageAsync(uri: string): Promise<string> {
  const token = await getToken();
  const form = new FormData();
  const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
  const mime = ext === "png" ? "image/png" : "image/jpeg";
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

const STEPS = [
  { key: "title", label: "Titre", help: "Commencez par l'essentiel" },
  { key: "category", label: "Catégorie", help: "Aidez les acheteurs à vous trouver" },
  { key: "photos", label: "Photos", help: "Les annonces avec photos sont 7× plus vues" },
  { key: "details", label: "Détails", help: "Décrivez votre article" },
  { key: "place", label: "Localisation", help: "Où récupérer l'article ?" },
  { key: "recap", label: "Récap", help: "Tout est prêt ?" },
] as const;

export default function PostScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<CategoryDef | null>(null);
  const [subcategory, setSubcategory] = useState<string>("");
  const [suggestedCat, setSuggestedCat] = useState<{ label: string; sub: string } | null>(null);
  const [suggestedAttrs, setSuggestedAttrs] = useState<{ brand: string | null; model: string | null; year: number | null }>({ brand: null, model: null, year: null });
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [autoFilledFromTitle, setAutoFilledFromTitle] = useState(false);
  const [priceSuggestion, setPriceSuggestion] = useState<{ suggested: number; range: { low: number; high: number }; sampleSize: number } | null>(null);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [condition, setCondition] = useState<string>("Bon état");
  const [phone, setPhone] = useState("");
  const [hidePhone, setHidePhone] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [slotPhotos, setSlotPhotos] = useState<SlotPhoto[]>([]);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const priceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftNotifId = useRef<string | null>(null);

  // Rappel local : si l'utilisateur quitte l'app avec un brouillon non vide,
  // planifie UNE notif 3 min plus tard. Cap : 1 rappel par 24h max — pas de harcèlement.
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (next: AppStateStatus) => {
      if (next === "background" || next === "inactive") {
        const hasDraft = title.trim() || description.trim() || images.length > 0 || price;
        if (!hasDraft || submitting) return;
        try {
          const lastReminderRaw = await SecureStore.getItemAsync(DRAFT_REMINDER_KEY);
          const lastReminder = lastReminderRaw ? parseInt(lastReminderRaw, 10) : 0;
          if (Date.now() - lastReminder < 24 * 60 * 60 * 1000) return;

          const id = await Notifications.scheduleNotificationAsync({
            content: {
              title: "Votre annonce vous attend",
              body: title.trim()
                ? `Reprenez « ${title.trim()} » en quelques secondes.`
                : "Reprenez votre brouillon là où vous en étiez.",
              data: { type: "draft_reminder", deepLink: "/(tabs)/post" },
              sound: "default",
            },
            trigger: { seconds: 180, channelId: "default" } as Notifications.TimeIntervalTriggerInput,
          });
          draftNotifId.current = id;
          await SecureStore.setItemAsync(DRAFT_REMINDER_KEY, String(Date.now()));
        } catch { /* noop */ }
      } else if (next === "active") {
        if (draftNotifId.current) {
          Notifications.cancelScheduledNotificationAsync(draftNotifId.current).catch(() => {});
          draftNotifId.current = null;
        }
      }
    });
    return () => sub.remove();
  }, [title, description, images.length, price, submitting]);
  // Auto-suggestion de catégorie : debounce sur le titre.
  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (title.trim().length < 4) { setSuggestedCat(null); return; }
    suggestTimer.current = setTimeout(() => {
      apiFetch<{
        categoryLabel: string | null;
        subcategory: string | null;
        attributes?: { brand: string | null; model: string | null; year: number | null };
      }>(
        `/api/listings/suggest-category?title=${encodeURIComponent(title.trim())}`,
        { auth: false },
      )
        .then((r) => {
          if (r.categoryLabel) setSuggestedCat({ label: r.categoryLabel, sub: r.subcategory ?? "" });
          else setSuggestedCat(null);
          if (r.attributes) {
            setSuggestedAttrs(r.attributes);
            let touched = false;
            if (r.attributes.brand) setBrand((cur) => { if (cur) return cur; touched = true; return r.attributes!.brand!; });
            if (r.attributes.model) setModel((cur) => { if (cur) return cur; touched = true; return r.attributes!.model!; });
            if (r.attributes.year) setYear((cur) => { if (cur) return cur; touched = true; return String(r.attributes!.year!); });
            if (touched) setAutoFilledFromTitle(true);
          }
        })
        .catch(() => setSuggestedCat(null));
    }, 350);
    return () => { if (suggestTimer.current) clearTimeout(suggestTimer.current); };
  }, [title]);

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

  const displayUri = (u: string) => (u.startsWith("http") ? u : `${API_BASE_URL}${u}`);

  const photoTemplate = getPhotoTemplate(category?.id);
  const slotPhotoFor = (slotKey: string) => slotPhotos.find((p) => p.slotKey === slotKey)?.url;
  const extraPhotos = slotPhotos.filter((p) => p.slotKey === null);

  const orderedImages = (() => {
    const ordered: string[] = [];
    for (const s of photoTemplate.slots) {
      const u = slotPhotoFor(s.key);
      if (u) ordered.push(u);
    }
    for (const p of extraPhotos) ordered.push(p.url);
    return ordered;
  })();

  const photoCount = slotPhotos.length;
  const canAddMore = photoCount < photoTemplate.maxPhotos;

  const pickSourceFor = async (
    onPicked: (assets: ImagePicker.ImagePickerAsset[]) => Promise<void>,
    multiple: boolean,
  ) => {
    const open = async (mode: "camera" | "library") => {
      if (mode === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission refusée", "Autorisez l'appareil photo."); return; }
        const res = await ImagePicker.launchCameraAsync({ quality: 0.85 });
        if (res.canceled) return;
        await onPicked(res.assets);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission refusée", "Autorisez l'accès aux photos."); return; }
        const remaining = photoTemplate.maxPhotos - photoCount;
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.85,
          allowsMultipleSelection: multiple && remaining > 1,
          selectionLimit: multiple ? remaining : 1,
        });
        if (res.canceled) return;
        await onPicked(res.assets);
      }
    };

    Haptics.selectionAsync().catch(() => {});
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Annuler", "Prendre une photo", "Choisir dans la galerie"], cancelButtonIndex: 0 },
        (i) => { if (i === 1) open("camera"); else if (i === 2) open("library"); },
      );
    } else {
      Alert.alert("Ajouter une photo", undefined, [
        { text: "Prendre une photo", onPress: () => open("camera") },
        { text: "Choisir dans la galerie", onPress: () => open("library") },
        { text: "Annuler", style: "cancel" },
      ]);
    }
  };

  const addPhotoToSlot = (slotKey: string) => {
    pickSourceFor(async (assets) => {
      const a = assets[0];
      if (!a) return;
      setUploadingSlot(slotKey);
      try {
        const url = await uploadImageAsync(a.uri);
        setSlotPhotos((prev) => {
          const others = prev.filter((p) => p.slotKey !== slotKey);
          return [...others, { slotKey, url }];
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch (e) {
        Alert.alert("Erreur", e instanceof Error ? e.message : "Upload échoué");
      } finally {
        setUploadingSlot(null);
      }
    }, false);
  };

  const addExtraPhotos = () => {
    pickSourceFor(async (assets) => {
      if (assets.length === 0) return;
      setUploadingImg(true);
      try {
        const uploads = await Promise.all(assets.map((a) => uploadImageAsync(a.uri)));
        setSlotPhotos((prev) => [...prev, ...uploads.map((url) => ({ slotKey: null, url }))]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch (e) {
        Alert.alert("Erreur", e instanceof Error ? e.message : "Upload échoué");
      } finally {
        setUploadingImg(false);
      }
    }, true);
  };

  const removeSlotPhoto = (slotKey: string | null, url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSlotPhotos((prev) => prev.filter((p) => !(p.slotKey === slotKey && p.url === url)));
  };

  // Conservé pour la rétro-compat (autres steps qui lisent `images`)
  useEffect(() => { setImages(orderedImages); }, [slotPhotos, category?.id]);

  // Prix conseillé : recalculé quand catégorie/sous-catégorie/marque/état changent.
  useEffect(() => {
    if (priceTimer.current) clearTimeout(priceTimer.current);
    if (!category) { setPriceSuggestion(null); return; }
    priceTimer.current = setTimeout(() => {
      const params = new URLSearchParams({ category: category.label });
      if (subcategory) params.set("subcategory", subcategory);
      if (brand.trim()) params.set("brand", brand.trim());
      if (condition) params.set("condition", condition);
      apiFetch<{ suggested: number | null; range: { low: number; high: number } | null; sampleSize: number }>(
        `/api/listings/suggest-price?${params.toString()}`,
        { auth: false },
      )
        .then((r) => {
          if (r.suggested && r.range) setPriceSuggestion({ suggested: r.suggested, range: r.range, sampleSize: r.sampleSize });
          else setPriceSuggestion(null);
        })
        .catch(() => setPriceSuggestion(null));
    }, 400);
    return () => { if (priceTimer.current) clearTimeout(priceTimer.current); };
  }, [category?.id, category?.label, subcategory, brand, condition]);

  // Si la catégorie change, requalifie les photos affectées à des slots disparus en extras.
  useEffect(() => {
    const validKeys = new Set(photoTemplate.slots.map((s) => s.key));
    setSlotPhotos((prev) => {
      let changed = false;
      const next = prev.map((p) => {
        if (p.slotKey && !validKeys.has(p.slotKey)) {
          changed = true;
          return { ...p, slotKey: null };
        }
        return p;
      });
      return changed ? next : prev;
    });
  }, [category?.id]);

  const onLocationFromMap = (v: LocationValue) => {
    setLocation(v.label);
    setLocationCoords({ lat: v.latitude, lng: v.longitude });
  };
  const mapValue: LocationValue | null = locationCoords
    ? { label: location, latitude: locationCoords.lat, longitude: locationCoords.lng }
    : null;

  const stepError = (s: number): string | null => {
    if (s === 0 && title.trim().length < 3) return "Indiquez un titre (3 caractères min).";
    if (s === 1 && !category) return "Choisissez une catégorie.";
    if (s === 2) {
      const min = photoTemplate.minPhotos;
      if (photoCount < Math.max(1, min)) {
        return min > 1 ? `Ajoutez au moins ${min} photos.` : "Ajoutez au moins une photo.";
      }
      const missingRequired = photoTemplate.slots
        .filter((sl) => sl.required && !slotPhotoFor(sl.key))
        .map((sl) => sl.label);
      if (missingRequired.length > 0) {
        return `Photo(s) manquante(s) : ${missingRequired.join(", ")}`;
      }
    }
    if (s === 3) {
      if (!price) return "Indiquez un prix.";
      if (!description.trim()) return "Ajoutez une description.";
    }
    if (s === 4 && !location.trim()) return "Indiquez la localisation.";
    return null;
  };

  const next = () => {
    const err = stepError(step);
    if (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(err);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const back = () => {
    Haptics.selectionAsync().catch(() => {});
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const close = () => {
    if (title.trim() || images.length > 0) {
      Alert.alert("Quitter ?", "Votre brouillon ne sera pas conservé.", [
        { text: "Annuler", style: "cancel" },
        { text: "Quitter", style: "destructive", onPress: () => router.replace("/(tabs)") },
      ]);
    } else {
      router.replace("/(tabs)");
    }
  };

  const pickSuggestedCategory = () => {
    if (!suggestedCat) return;
    const cat = CATEGORIES.find((c) => c.label === suggestedCat.label);
    if (!cat) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setCategory(cat);
    setSubcategory(suggestedCat.sub);
  };

  const selectCategory = (c: CategoryDef) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setCategory(c);
    setSubcategory("");
  };

  const submit = async () => {
    setError(null);
    if (!title.trim() || !price || !category || !description.trim() || !location.trim()) {
      setError("Champs obligatoires manquants.");
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
            metadata: {
              ...(brand.trim() ? { brand: brand.trim() } : {}),
              ...(model.trim() ? { model: model.trim() } : {}),
              ...(year.trim() ? { year: parseInt(year, 10) } : {}),
              ...(locationCoords ? { lat: locationCoords.lat, lng: locationCoords.lng } : {}),
            },
            phone: phone.trim() || null,
            hidePhone,
          }),
        },
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (draftNotifId.current) {
        Notifications.cancelScheduledNotificationAsync(draftNotifId.current).catch(() => {});
        draftNotifId.current = null;
      }
      if (created.status === "REJECTED") {
        Alert.alert("Annonce refusée", created.rejectionReason ?? "Annonce refusée par la modération.");
      } else if (created.status === "PENDING") {
        Alert.alert("En attente de validation", "Votre annonce sera publiée après vérification.");
      } else {
        Alert.alert("Annonce publiée 🎉", "Votre annonce est en ligne !");
      }
      router.replace(`/annonce/${created.id}`);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(e instanceof Error ? e.message : "Erreur lors de la publication");
    } finally {
      setSubmitting(false);
    }
  };

  const current = STEPS[step];

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        {/* Top bar : titre + croix */}
        <View className="flex-row items-center justify-between px-4 py-3">
          {step > 0 ? (
            <Pressable onPress={back} hitSlop={10} className="p-1 active:opacity-60">
              <Ionicons name="chevron-back" size={26} color="#1a1a1a" />
            </Pressable>
          ) : <View style={{ width: 26 }} />}
          <Text className="text-on-surface text-base font-extrabold">Déposer une annonce</Text>
          <Pressable onPress={close} hitSlop={10} className="p-1 active:opacity-60">
            <Ionicons name="close" size={26} color="#1a1a1a" />
          </Pressable>
        </View>

        {/* Progress bar */}
        <View className="flex-row gap-1 px-4 mb-4">
          {STEPS.map((_, i) => (
            <View key={i} className={`flex-1 h-1 rounded-full ${i <= step ? "bg-primary" : "bg-surface-container"}`} />
          ))}
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <Text className="text-on-surface-variant text-xs font-bold uppercase tracking-wider">
            Étape {step + 1} / {STEPS.length}
          </Text>
          <Text className="text-on-surface text-2xl font-extrabold mt-1">{current.help}</Text>

          {/* ── Étape 0 : Titre ──────────────────────────────────────────── */}
          {step === 0 && (
            <>
              <Text className="text-on-surface-variant text-sm mt-2 mb-4">
                Un titre précis = la bonne catégorie = plus d'acheteurs qui voient votre annonce.
              </Text>
              <Label>Titre de l'annonce</Label>
              <Field
                value={title}
                onChangeText={setTitle}
                placeholder="ex : iPhone 14 Pro 256 Go"
                maxLength={120}
                autoFocus
              />
              {suggestedCat && (
                <Pressable
                  onPress={pickSuggestedCategory}
                  className="flex-row items-center bg-primary/10 border border-primary/30 rounded-xl px-3 py-3 mt-2 active:opacity-80"
                >
                  <Ionicons name="sparkles" size={18} color="#2f6fb8" />
                  <View className="flex-1 ml-2">
                    <Text className="text-primary text-xs font-bold">Catégorie suggérée</Text>
                    <Text className="text-on-surface text-sm font-semibold">
                      {suggestedCat.label}{suggestedCat.sub ? ` · ${suggestedCat.sub}` : ""}
                    </Text>
                  </View>
                  <Text className="text-primary text-sm font-bold">Utiliser</Text>
                </Pressable>
              )}
            </>
          )}

          {/* ── Étape 1 : Catégorie + sous-cat ──────────────────────────── */}
          {step === 1 && (
            <>
              <Text className="text-on-surface-variant text-sm mt-2 mb-4">
                Choisissez la catégorie qui correspond le mieux à votre article.
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {CATEGORIES.map((c) => {
                  const active = category?.id === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => selectCategory(c)}
                      className={`px-4 py-2.5 rounded-full ${active ? "bg-primary" : "bg-surface-container"}`}
                    >
                      <Text className={`text-sm font-semibold ${active ? "text-white" : "text-on-surface-variant"}`}>{c.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {category && category.subcategories.length > 0 && (
                <>
                  <Label className="mt-6">Sous-catégorie (optionnel)</Label>
                  <View className="flex-row flex-wrap gap-2">
                    {category.subcategories.map((s) => {
                      const active = subcategory === s;
                      return (
                        <Pressable
                          key={s}
                          onPress={() => { Haptics.selectionAsync().catch(() => {}); setSubcategory(s); }}
                          className={`px-3 py-2 rounded-full ${active ? "bg-primary" : "bg-surface-container"}`}
                        >
                          <Text className={`text-sm font-semibold ${active ? "text-white" : "text-on-surface-variant"}`}>{s}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </>
          )}

          {/* ── Étape 2 : Photos guidées par catégorie ──────────────────── */}
          {step === 2 && (
            <>
              <Text className="text-on-surface-variant text-sm mt-2 mb-4">
                {photoTemplate.minPhotos > 1
                  ? `Ajoutez au moins ${photoTemplate.minPhotos} photos. Les annonces avec photos sont 7× plus vues.`
                  : "Suivez les vignettes pour des photos qui rassurent."}
              </Text>

              {/* Indicateur progression */}
              <View className="flex-row items-center mb-3">
                <View className="flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
                  <View
                    className="h-full bg-primary"
                    style={{ width: `${Math.min(100, (photoCount / Math.max(1, photoTemplate.minPhotos)) * 100)}%` }}
                  />
                </View>
                <Text className="text-on-surface-variant text-xs ml-3 font-semibold">
                  {photoCount}/{photoTemplate.maxPhotos}
                </Text>
              </View>

              {/* Slots template */}
              <View className="flex-row flex-wrap gap-2">
                {photoTemplate.slots.map((slot) => (
                  <PhotoSlotCard
                    key={slot.key}
                    slot={slot}
                    url={slotPhotoFor(slot.key)}
                    loading={uploadingSlot === slot.key}
                    displayUri={displayUri}
                    onAdd={() => addPhotoToSlot(slot.key)}
                    onRemove={(u) => removeSlotPhoto(slot.key, u)}
                  />
                ))}
              </View>

              {/* Extras */}
              <Text className="text-on-surface text-sm font-bold mt-6 mb-2">{photoTemplate.extraLabel}</Text>
              <View className="flex-row flex-wrap gap-2">
                {extraPhotos.map((p) => (
                  <View key={p.url} className="w-[31%] aspect-square bg-surface-container rounded-xl overflow-hidden relative">
                    <Image source={{ uri: displayUri(p.url) }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    <Pressable
                      onPress={() => removeSlotPhoto(null, p.url)}
                      className="absolute top-1 right-1 bg-black/70 rounded-full w-6 h-6 items-center justify-center"
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                {canAddMore && (
                  <Pressable
                    onPress={addExtraPhotos}
                    disabled={uploadingImg}
                    className="w-[31%] aspect-square border-2 border-dashed border-outline/50 rounded-xl items-center justify-center bg-surface-container-low"
                  >
                    {uploadingImg ? (
                      <ActivityIndicator color="#94a3b8" />
                    ) : (
                      <>
                        <Ionicons name="add" size={28} color="#94a3b8" />
                        <Text className="text-on-surface-variant text-xs font-bold mt-1">Ajouter</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            </>
          )}

          {/* ── Étape 3 : Détails (prix, état, description) ─────────────── */}
          {step === 3 && (
            <>
              <Text className="text-on-surface-variant text-sm mt-2 mb-4">
                Plus c'est précis, plus on vous fait confiance.
              </Text>
              {/* Bandeau auto-fill */}
              {autoFilledFromTitle && (brand || model || year) && (
                <View className="flex-row items-center bg-primary/10 border border-primary/30 rounded-xl px-3 py-2 mb-4">
                  <Ionicons name="sparkles" size={16} color="#2f6fb8" />
                  <Text className="text-primary text-xs font-semibold ml-2 flex-1">Champs pré-remplis depuis votre titre</Text>
                </View>
              )}

              {/* Brand / Model / Year — apparaissent si pertinents (détectés OU catégorie le justifie) */}
              {(suggestedAttrs.brand || suggestedAttrs.model || suggestedAttrs.year || brand || model || year) && (
                <>
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Label>Marque</Label>
                      <Field value={brand} onChangeText={(t) => { setBrand(t); setAutoFilledFromTitle(false); }} placeholder="ex : Apple" />
                    </View>
                    <View className="flex-1">
                      <Label>Modèle</Label>
                      <Field value={model} onChangeText={(t) => { setModel(t); setAutoFilledFromTitle(false); }} placeholder="ex : iPhone 14" />
                    </View>
                  </View>
                  <Label className="mt-4">Année</Label>
                  <Field value={year} onChangeText={(t) => { setYear(t.replace(/\D/g, "").slice(0, 4)); setAutoFilledFromTitle(false); }} placeholder="ex : 2023" keyboardType="number-pad" maxLength={4} />
                </>
              )}

              <Label className="mt-4">Prix (€)</Label>
              <Field value={price} onChangeText={setPrice} placeholder="0" keyboardType="decimal-pad" />
              {priceSuggestion && (
                <Pressable
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setPrice(String(priceSuggestion.suggested)); }}
                  className="flex-row items-center bg-primary/10 border border-primary/30 rounded-xl px-3 py-2.5 mt-2 active:opacity-80"
                >
                  <Ionicons name="trending-up" size={18} color="#2f6fb8" />
                  <View className="flex-1 ml-2">
                    <Text className="text-primary text-xs font-bold">Prix conseillé : {priceSuggestion.suggested} €</Text>
                    <Text className="text-on-surface-variant text-[11px]">Fourchette {priceSuggestion.range.low}–{priceSuggestion.range.high} € · basé sur {priceSuggestion.sampleSize} annonces</Text>
                  </View>
                  <Text className="text-primary text-xs font-bold">Utiliser</Text>
                </Pressable>
              )}

              <Label className="mt-4">État</Label>
              <View className="flex-row flex-wrap gap-2">
                {CONDITIONS.map((c) => {
                  const active = condition === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => { Haptics.selectionAsync().catch(() => {}); setCondition(c); }}
                      className={`px-3 py-2 rounded-full ${active ? "bg-primary" : "bg-surface-container"}`}
                    >
                      <Text className={`text-sm font-semibold ${active ? "text-white" : "text-on-surface-variant"}`}>{c}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Label className="mt-4">Description</Label>
              <Field
                value={description}
                onChangeText={setDescription}
                placeholder="Décrivez votre article (dimensions, défauts, accessoires, raison de la vente...)"
                multiline
                maxLength={10000}
                style={{ minHeight: 140, textAlignVertical: "top" }}
              />
            </>
          )}

          {/* ── Étape 4 : Localisation + téléphone ──────────────────────── */}
          {step === 4 && (
            <>
              <Text className="text-on-surface-variant text-sm mt-2 mb-4">
                Indiquez où vous vous trouvez. Votre adresse exacte n'est pas affichée.
              </Text>

              <Label>Carte</Label>
              <MapLocationPicker value={mapValue} onChange={onLocationFromMap} />

              <Label className="mt-4">Ville ou code postal</Label>
              <Field value={location} onChangeText={setLocation} placeholder="ex : Paris 75011" />

              <Label className="mt-4">Téléphone (optionnel)</Label>
              <Field value={phone} onChangeText={setPhone} placeholder="06 12 34 56 78" keyboardType="phone-pad" />
              {phone.trim() && (
                <Pressable
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setHidePhone((v) => !v); }}
                  className="flex-row items-center mt-3"
                >
                  <View className={`w-5 h-5 rounded border-2 mr-2 items-center justify-center ${hidePhone ? "bg-primary border-primary" : "border-outline"}`}>
                    {hidePhone && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text className="text-on-surface text-sm">Masquer mon numéro publiquement</Text>
                </Pressable>
              )}
            </>
          )}

          {/* ── Étape 5 : Récap / Preview annonce ──────────────────────── */}
          {step === 5 && (
            <View className="mt-2">
              <View className="flex-row items-center mb-3">
                <Ionicons name="eye" size={18} color="#2f6fb8" />
                <Text className="text-primary text-xs font-bold ml-1.5 uppercase tracking-wider">Aperçu de votre annonce</Text>
              </View>

              {/* Carrousel mini */}
              {images.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 -mx-4 px-4">
                  {images.map((url, i) => (
                    <Image
                      key={url}
                      source={{ uri: displayUri(url) }}
                      style={{ width: 220, height: 220, borderRadius: 14, marginRight: i === images.length - 1 ? 0 : 8 }}
                      contentFit="cover"
                    />
                  ))}
                </ScrollView>
              )}

              <Text className="text-on-surface text-2xl font-extrabold" numberOfLines={2}>{title || "Sans titre"}</Text>
              <Text className="text-primary text-2xl font-extrabold mt-1">{price ? `${price} €` : "Prix non indiqué"}</Text>
              <View className="mt-4 bg-surface-container-low rounded-xl p-3">
                <RecapRow icon="pricetag" label="Catégorie" value={[category?.label, subcategory].filter(Boolean).join(" · ") || "—"} />
                {(brand || model) && <RecapRow icon="ribbon" label="Marque · Modèle" value={[brand, model].filter(Boolean).join(" ")} />}
                {year && <RecapRow icon="calendar" label="Année" value={year} />}
                <RecapRow icon="construct" label="État" value={condition} />
                <RecapRow icon="location" label="Localisation" value={location || "—"} />
                <RecapRow icon="images" label="Photos" value={`${images.length}`} />
                {phone.trim() ? <RecapRow icon="call" label="Téléphone" value={hidePhone ? `${phone} (masqué)` : phone} last /> : null}
              </View>
              {description && (
                <View className="mt-4">
                  <Text className="text-on-surface-variant text-xs font-bold uppercase tracking-wider mb-1">Description</Text>
                  <Text className="text-on-surface text-sm leading-relaxed" numberOfLines={6}>{description}</Text>
                </View>
              )}
            </View>
          )}

          {error && (
            <View className="bg-red-50 border border-red-200 rounded-xl p-3 mt-4">
              <Text className="text-red-700 text-sm">{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Pied : Continuer / Publier */}
        <View className="px-4 py-3 border-t border-surface-container bg-surface">
          {step < STEPS.length - 1 ? (
            <Pressable onPress={next} className="bg-primary py-4 rounded-full items-center active:opacity-90">
              <Text className="text-white font-bold text-base">Continuer</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={submit}
              disabled={submitting}
              className={`py-4 rounded-full items-center ${submitting ? "bg-outline" : "bg-primary"}`}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-base">Publier mon annonce</Text>}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PhotoSlotCard({
  slot, url, loading, displayUri, onAdd, onRemove,
}: {
  slot: PhotoSlot;
  url: string | undefined;
  loading: boolean;
  displayUri: (u: string) => string;
  onAdd: () => void;
  onRemove: (url: string) => void;
}) {
  if (url) {
    return (
      <View className="w-[31%] mb-3">
        <View className="w-full aspect-square bg-surface-container rounded-xl overflow-hidden relative border-2 border-primary">
          <Image source={{ uri: displayUri(url) }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          <Pressable
            onPress={() => onRemove(url)}
            className="absolute top-1 right-1 bg-black/70 rounded-full w-6 h-6 items-center justify-center"
          >
            <Ionicons name="close" size={14} color="#fff" />
          </Pressable>
        </View>
        <Text className="text-on-surface text-[11px] font-bold mt-1.5" numberOfLines={1}>{slot.label}</Text>
      </View>
    );
  }

  return (
    <Pressable onPress={onAdd} disabled={loading} className="w-[31%] mb-3 active:opacity-80">
      <View className={`w-full aspect-square rounded-xl items-center justify-center border-2 border-dashed ${slot.required ? "border-primary/60 bg-primary/5" : "border-outline/40 bg-surface-container-low"}`}>
        {loading ? (
          <ActivityIndicator color="#2f6fb8" />
        ) : (
          <>
            <Ionicons name={slot.icon} size={26} color={slot.required ? "#2f6fb8" : "#94a3b8"} />
            {slot.required && (
              <View className="absolute top-1.5 right-1.5 bg-primary rounded-full w-4 h-4 items-center justify-center">
                <Text className="text-white text-[9px] font-extrabold">*</Text>
              </View>
            )}
          </>
        )}
      </View>
      <Text className={`text-[11px] font-bold mt-1.5 ${slot.required ? "text-on-surface" : "text-on-surface-variant"}`} numberOfLines={1}>{slot.label}</Text>
      {slot.hint && (
        <Text className="text-on-surface-variant text-[10px]" numberOfLines={1}>{slot.hint}</Text>
      )}
    </Pressable>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Text className={`text-on-surface text-sm font-bold mb-1.5 ${className ?? ""}`}>{children}</Text>
  );
}

function Field(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="#94a3b8"
      className="bg-surface-container rounded-xl px-3 py-3 text-on-surface"
    />
  );
}

function RecapRow({
  icon, label, value, last,
}: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) {
  return (
    <View className={`flex-row items-center py-2 ${last ? "" : "border-b border-surface-container"}`}>
      <Ionicons name={icon} size={16} color="#94a3b8" />
      <Text className="text-on-surface-variant text-sm ml-2 flex-1">{label}</Text>
      <Text className="text-on-surface text-sm font-semibold flex-1 text-right" numberOfLines={1}>{value}</Text>
    </View>
  );
}

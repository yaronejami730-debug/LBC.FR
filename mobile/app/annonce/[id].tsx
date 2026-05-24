import { useCallback, useEffect, useState } from "react";
import {
  ScrollView, View, Text, ActivityIndicator, Pressable,
  Dimensions, Alert, Share, Linking, Platform, ActionSheetIOS,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatPrice, timeAgo, allImages, firstImage } from "@/lib/format";
import { Skeleton } from "@/components/Skeleton";
import { FullscreenPhotoViewer } from "@/components/FullscreenPhotoViewer";
import { buildSpecs, buildEquipment } from "@/lib/listingSpecs";

const SITE_URL = "https://www.dealandcompany.fr";
const SCREEN_W = Dimensions.get("window").width;

type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  location: string;
  category: string;
  subcategory?: string | null;
  condition?: string | null;
  images: string | string[] | null;
  createdAt: string;
  phone?: string | null;
  hidePhone?: boolean;
  userId: string;
  vehicleKm?: number | null;
  vehicleYear?: number | null;
  immoSurface?: number | null;
  immoRooms?: number | null;
  metadata?: string | Record<string, unknown> | null;
  user: {
    id: string; name: string; avatar?: string | null;
    verified?: boolean; isPro?: boolean; companyName?: string | null;
    memberSince: string; listingsCount: number;
  };
};

type RelatedListing = {
  id: string; title: string; price: number; location: string;
  images: string | string[] | null; createdAt: string; isPremium?: boolean;
};

type Ad = {
  id: string; title: string; description: string;
  imageUrl: string; imageUrlWide: string | null; destinationUrl: string;
};

function memberYear(iso: string): string {
  return new Date(iso).getFullYear().toString();
}

function trackAd(id: string, type: "click" | "impression") {
  apiFetch("/api/ads/track", {
    method: "POST", auth: false,
    body: JSON.stringify({ id, type, placement: "rotator" }),
  }).catch(() => {});
}

export default function AnnonceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [related, setRelated] = useState<{ sellerOthers: RelatedListing[]; similar: RelatedListing[] }>({ sellerOthers: [], similar: [] });
  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [phoneShown, setPhoneShown] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [specsExpanded, setSpecsExpanded] = useState(false);
  const [equipExpanded, setEquipExpanded] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const loadFav = useCallback(async () => {
    if (!user || !id) return;
    try {
      const favs = await apiFetch<{ listing: { id: string } }[]>("/api/favorites");
      setIsFav(favs.some((f) => f.listing.id === id));
    } catch { /* noop */ }
  }, [user, id]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [data, rel, adRes] = await Promise.all([
          apiFetch<Listing>(`/api/listings/${id}`, { auth: false }),
          apiFetch<typeof related>(`/api/listings/${id}/related`, { auth: false }).catch(() => ({ sellerOthers: [], similar: [] })),
          apiFetch<Ad[]>("/api/ads", { auth: false }).catch(() => [] as Ad[]),
        ]);
        setListing(data);
        setRelated(rel);
        if (adRes.length > 0) {
          setAd(adRes[0]);
          trackAd(adRes[0].id, "impression");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    })();
    loadFav();
  }, [id, loadFav]);

  // Géocode la localisation via Nominatim — coords pour MapView natif.
  useEffect(() => {
    if (!listing?.location) return;
    let cancelled = false;
    (async () => {
      try {
        const geo = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(listing.location)}`,
          { headers: { "User-Agent": "DealAndCo/1.0" } },
        );
        const data = (await geo.json()) as { lat: string; lon: string }[];
        if (cancelled || !data?.[0]) return;
        setCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, [listing?.location]);

  const toggleFav = async () => {
    if (!user) { router.push("/(auth)/login"); return; }
    if (!listing || favBusy) return;
    setFavBusy(true);
    const next = !isFav;
    setIsFav(next);
    try {
      await apiFetch("/api/favorites", {
        method: next ? "POST" : "DELETE",
        body: JSON.stringify({ listingId: listing.id }),
      });
    } catch {
      setIsFav(!next);
      Alert.alert("Erreur", "Impossible de mettre à jour le favori.");
    } finally {
      setFavBusy(false);
    }
  };

  const contact = async () => {
    if (!user) { router.push("/(auth)/login"); return; }
    if (!listing) return;
    if (listing.userId === user.id) {
      Alert.alert("Action impossible", "Vous ne pouvez pas vous contacter vous-même.");
      return;
    }
    setContactBusy(true);
    apiFetch(`/api/listings/${listing.id}/click`, {
      method: "POST",
      auth: false,
      body: JSON.stringify({ type: "message" }),
    }).catch(() => {});
    try {
      const conv = await apiFetch<{ id: string }>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ listingId: listing.id, sellerId: listing.userId }),
      });
      router.push(`/messages/${conv.id}`);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Impossible de démarrer la conversation");
    } finally {
      setContactBusy(false);
    }
  };

  const callSeller = () => {
    if (!listing?.phone) return;
    setPhoneShown(true);
    apiFetch(`/api/listings/${listing.id}/click`, {
      method: "POST",
      auth: false,
      body: JSON.stringify({ type: "phone" }),
    }).catch(() => {});
    Linking.openURL(`tel:${listing.phone}`).catch(() => {});
  };

  const whatsAppSeller = async () => {
    if (!listing?.phone || !listing) return;
    const cleaned = listing.phone.replace(/[\s\-().+]/g, "").replace(/^0/, "33");
    const text = `Bonjour, votre annonce "${listing.title}" m'intéresse.`;
    const url = `whatsapp://send?phone=${cleaned}&text=${encodeURIComponent(text)}`;
    const ok = await Linking.canOpenURL(url);
    if (!ok) {
      Linking.openURL(`https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`).catch(() => {});
      return;
    }
    Linking.openURL(url);
  };

  const shareUrl = listing ? `${SITE_URL}/annonce/${listing.id}` : SITE_URL;
  const openShare = () => {
    if (!listing) return;
    const message = `${listing.title} — ${formatPrice(listing.price)}\n${shareUrl}`;
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Annuler", "WhatsApp", "Copier le lien", "Plus…"], cancelButtonIndex: 0 },
        async (i) => {
          if (i === 1) {
            const cleaned = encodeURIComponent(message);
            Linking.openURL(`whatsapp://send?text=${cleaned}`).catch(() => {
              Linking.openURL(`https://wa.me/?text=${cleaned}`);
            });
          } else if (i === 2) {
            await Clipboard.setStringAsync(shareUrl);
            Alert.alert("Lien copié");
          } else if (i === 3) {
            Share.share({ message, url: shareUrl }).catch(() => {});
          }
        },
      );
    } else {
      Share.share({ message, url: shareUrl }).catch(() => {});
    }
  };

  const openMap = () => {
    if (!listing?.location) return;
    router.push({ pathname: "/localisation", params: { location: listing.location } });
  };

  if (loading) {
    return (
      <View className="flex-1 bg-surface">
        <Skeleton width={SCREEN_W} height={SCREEN_W} borderRadius={0} />
        <View className="p-4">
          <Skeleton width={120} height={16} />
          <View style={{ height: 10 }} />
          <Skeleton width="80%" height={36} />
          <View style={{ height: 10 }} />
          <Skeleton width="60%" height={20} />
          <View style={{ height: 24 }} />
          <Skeleton width="100%" height={120} borderRadius={16} />
          <View style={{ height: 16 }} />
          <Skeleton width="100%" height={90} borderRadius={16} />
        </View>
      </View>
    );
  }
  if (error || !listing) {
    return (
      <View className="flex-1 bg-surface items-center justify-center px-6">
        <Text className="text-red-600 text-center mb-4">{error ?? "Annonce introuvable"}</Text>
        <Pressable onPress={() => router.back()} className="bg-primary px-4 py-2 rounded-full">
          <Text className="text-white font-semibold">Retour</Text>
        </Pressable>
      </View>
    );
  }

  const images = allImages(listing.images);
  const sellerName = listing.user.isPro && listing.user.companyName ? listing.user.companyName : listing.user.name;
  const isMine = user?.id === listing.userId;
  const specs = [
    listing.vehicleYear,
    listing.vehicleKm ? `${listing.vehicleKm.toLocaleString("fr-FR")} km` : null,
    listing.immoSurface ? `${listing.immoSurface} m²` : null,
    listing.immoRooms ? `${listing.immoRooms} pièces` : null,
    listing.condition,
  ].filter(Boolean) as string[];

  const structuredSpecs = buildSpecs(listing, listing.metadata);
  const equipment = buildEquipment(listing.metadata);

  const adImg = ad ? (ad.imageUrlWide ?? ad.imageUrl) : null;
  const adImgAbs = adImg ? (adImg.startsWith("http") ? adImg : `${process.env.EXPO_PUBLIC_API_URL ?? ""}${adImg}`) : null;

  const faq = [
    { q: "Comment contacter le vendeur ?", a: "Cliquez sur « Message » pour démarrer une conversation directement dans l'application." },
    { q: "Comment se passe le paiement ?", a: "Le paiement se fait directement entre vous et le vendeur. Privilégiez les paiements sécurisés et évitez les virements à l'avance." },
    { q: "Comment récupérer l'article ?", a: "Convenez avec le vendeur d'un lieu de remise en main propre, idéalement dans un lieu public." },
    { q: "L'article est-il garanti ?", a: "Les annonces entre particuliers ne sont pas garanties. Inspectez l'article avant l'achat." },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: "",
          headerBackTitle: "Retour",
          headerRight: () => (
            <View className="flex-row items-center">
              <Pressable onPress={openShare} className="px-2"><Ionicons name="share-outline" size={24} color="#2f6fb8" /></Pressable>
              {!isMine && (
                <Pressable onPress={toggleFav} disabled={favBusy} className="px-2">
                  <Ionicons name={isFav ? "heart" : "heart-outline"} size={24} color={isFav ? "#ef4444" : "#1a1a1a"} />
                </Pressable>
              )}
            </View>
          ),
        }}
      />
      <ScrollView className="flex-1 bg-surface" contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Galerie : swipe horizontal TOUTES les photos, tap = ouvre visionneuse */}
        {images.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => setGalleryIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
              scrollEventThrottle={16}
            >
              {images.map((src, i) => (
                <Pressable key={i} onPress={() => { setGalleryIndex(i); setGalleryOpen(true); }}>
                  <Image
                    source={{ uri: src }}
                    style={{ width: SCREEN_W, height: SCREEN_W }}
                    contentFit="cover"
                    priority={i === 0 ? "high" : "normal"}
                    cachePolicy="memory-disk"
                    transition={120}
                    placeholder={{ blurhash: "L6PZfSi_.AyE_3t7t7R**0o#DgR4" }}
                  />
                </Pressable>
              ))}
            </ScrollView>
            {/* Compteur photo bas-droite */}
            <View className="absolute right-3 bottom-3 bg-black/70 px-3 py-1.5 rounded-full flex-row items-center">
              <Ionicons name="images" size={12} color="#fff" />
              <Text className="text-white text-xs font-bold ml-1.5">{galleryIndex + 1} / {images.length}</Text>
            </View>
          </View>
        ) : (
          <View style={{ width: SCREEN_W, height: SCREEN_W }} className="bg-surface-container items-center justify-center">
            <Ionicons name="image-outline" size={40} color="#94a3b8" />
            <Text className="text-outline mt-2">Aucune photo</Text>
          </View>
        )}

        {/* Bloc principal — hiérarchie : date (petit) → titre (moyen) → prix (très gros) */}
        <View className="p-4">
          <Text className="text-on-surface-variant text-xs">Publié le {new Date(listing.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</Text>
          <Text className="text-on-surface text-xl font-bold mt-1.5">{listing.title}</Text>
          <Text className="text-primary text-4xl font-extrabold mt-2">{formatPrice(listing.price)}</Text>

          <View className="flex-row items-center mt-3">
            <Ionicons name="location-outline" size={14} color="#94a3b8" />
            <Text className="text-on-surface-variant text-sm ml-1 flex-1">{listing.location}</Text>
            <Text className="text-on-surface-variant text-sm">{timeAgo(listing.createdAt)}</Text>
          </View>

          <View className="mt-3 flex-row gap-2 flex-wrap">
            <Chip>{listing.category}</Chip>
            {listing.subcategory ? <Chip>{listing.subcategory}</Chip> : null}
          </View>

          {structuredSpecs.length > 0 && (() => {
            const KEY_COUNT = 6;
            const visibleSpecs = specsExpanded ? structuredSpecs : structuredSpecs.slice(0, KEY_COUNT);
            const extra = structuredSpecs.length - KEY_COUNT;
            return (
              <>
                <SectionTitle>Caractéristiques</SectionTitle>
                <View className="bg-surface-container-low rounded-2xl p-4">
                  {visibleSpecs.map((sp, i) => (
                    <View
                      key={`${sp.label}-${i}`}
                      className={`flex-row items-center justify-between ${i < visibleSpecs.length - 1 ? "border-b border-surface-container pb-2.5 mb-2.5" : ""}`}
                    >
                      <Text className="text-on-surface-variant text-sm">{sp.label}</Text>
                      <Text className="text-on-surface text-sm font-semibold">{sp.value}</Text>
                    </View>
                  ))}
                </View>
                {extra > 0 && (
                  <Pressable
                    onPress={() => setSpecsExpanded((v) => !v)}
                    className="mt-3 self-start"
                  >
                    <Text className="text-primary text-sm font-bold">
                      {specsExpanded ? "Réduire" : `Voir ${extra} critère${extra > 1 ? "s" : ""} supplémentaire${extra > 1 ? "s" : ""}`}
                    </Text>
                  </Pressable>
                )}
              </>
            );
          })()}

          {equipment.length > 0 && (
            <>
              <SectionTitle>Équipements</SectionTitle>
              {equipExpanded ? (
                <View className="flex-row flex-wrap gap-2">
                  {equipment.map((opt, i) => (
                    <View key={`${opt}-${i}`} className="flex-row items-center bg-surface-container-low rounded-full px-3 py-1.5">
                      <Ionicons name="checkmark" size={14} color="#16a34a" />
                      <Text className="text-on-surface text-xs font-semibold ml-1.5">{opt}</Text>
                    </View>
                  ))}
                  <Pressable onPress={() => setEquipExpanded(false)} className="px-3 py-1.5">
                    <Text className="text-primary text-xs font-bold">Réduire</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setEquipExpanded(true)}
                  className="bg-surface-container-low rounded-2xl px-4 py-3 flex-row items-center active:opacity-80"
                >
                  <Ionicons name="options" size={18} color="#2f6fb8" />
                  <Text className="text-on-surface text-sm font-semibold ml-3 flex-1">
                    {equipment.length} équipement{equipment.length > 1 ? "s" : ""} et option{equipment.length > 1 ? "s" : ""}
                  </Text>
                  <Text className="text-primary text-sm font-bold mr-2">Voir plus</Text>
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                </Pressable>
              )}
            </>
          )}

          {/* Vendeur */}
          <SectionTitle>{listing.user.isPro ? "Vendeur professionnel" : "Vendeur"}</SectionTitle>
          <View className="bg-surface-container-low rounded-2xl p-4">
            <View className="flex-row items-center">
              <Pressable
                onPress={() => Alert.alert("Profil vendeur", "L'écran profil vendeur arrive bientôt.")}
                className="w-14 h-14 rounded-full overflow-hidden bg-surface-container mr-3"
              >
                {listing.user.avatar ? (
                  <Image source={{ uri: listing.user.avatar }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                ) : (
                  <View className="flex-1 items-center justify-center"><Ionicons name="person" size={24} color="#94a3b8" /></View>
                )}
              </Pressable>
              <View className="flex-1">
                <View className="flex-row items-center gap-2 flex-wrap">
                  <Text className="text-on-surface text-base font-bold">{sellerName}</Text>
                  {listing.user.isPro && (
                    <View className="border border-primary rounded-full px-2 py-0.5">
                      <Text className="text-primary text-[10px] font-bold">Pro</Text>
                    </View>
                  )}
                </View>
                {listing.user.verified && (
                  <View className="flex-row items-center mt-0.5">
                    <Ionicons name="checkmark-circle" size={12} color="#2f6fb8" />
                    <Text className="text-primary text-xs font-semibold ml-1">Vendeur vérifié</Text>
                  </View>
                )}
                <Text className="text-on-surface-variant text-xs mt-1">
                  Membre depuis {memberYear(listing.user.memberSince)} · {listing.user.listingsCount} annonce{listing.user.listingsCount > 1 ? "s" : ""}
                </Text>
              </View>
            </View>

            {/* CTAs */}
            {!isMine && (
              <View className="mt-4 gap-2">
                <Pressable
                  onPress={contact}
                  disabled={contactBusy}
                  className="bg-primary py-3 rounded-full flex-row items-center justify-center active:opacity-80"
                >
                  {contactBusy ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Ionicons name="chatbubble" size={16} color="#fff" />
                      <Text className="text-white font-bold ml-2">Envoyer un message</Text>
                    </>
                  )}
                </Pressable>
                {listing.phone && !listing.hidePhone && (
                  <View className="flex-row gap-2">
                    <Pressable onPress={callSeller} className="flex-1 border border-primary py-3 rounded-full flex-row items-center justify-center active:opacity-70">
                      <Ionicons name="call" size={16} color="#2f6fb8" />
                      <Text className="text-primary font-bold ml-2" numberOfLines={1}>
                        {phoneShown ? listing.phone : "Afficher le numéro"}
                      </Text>
                    </Pressable>
                    <Pressable onPress={whatsAppSeller} className="flex-1 bg-[#25D366] py-3 rounded-full flex-row items-center justify-center active:opacity-80">
                      <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                      <Text className="text-white font-bold ml-2">WhatsApp</Text>
                    </Pressable>
                  </View>
                )}
                {listing.phone && listing.hidePhone && (
                  <Pressable onPress={whatsAppSeller} className="bg-[#25D366] py-3 rounded-full flex-row items-center justify-center active:opacity-80">
                    <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                    <Text className="text-white font-bold ml-2">Contacter par WhatsApp</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {/* Conseil sécurité */}
          <View className="mt-4 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex-row items-start">
            <Ionicons name="shield-checkmark" size={22} color="#2563eb" />
            <View className="flex-1 ml-3">
              <Text className="text-blue-900 font-bold text-sm">Conseil de sécurité</Text>
              <Text className="text-blue-800 text-xs mt-1 leading-relaxed">
                Rencontrez-vous dans un lieu public et ne payez jamais avant d'avoir vu l'article.
              </Text>
            </View>
          </View>

          <SectionTitle>Description</SectionTitle>
          <View>
            <Text
              className="text-on-surface text-[15px] leading-relaxed"
              numberOfLines={descExpanded ? undefined : 3}
            >
              {listing.description}
            </Text>
            {!descExpanded && (
              <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 28 }} className="bg-gradient-to-t from-surface to-transparent" />
            )}
          </View>
          {!descExpanded && listing.description.length > 120 && (
            <Pressable onPress={() => setDescExpanded(true)} className="mt-2">
              <Text className="text-primary text-sm font-bold">Voir plus</Text>
            </Pressable>
          )}
          {descExpanded && (
            <Pressable onPress={() => setDescExpanded(false)} className="mt-2">
              <Text className="text-primary text-sm font-bold">Voir moins</Text>
            </Pressable>
          )}

          <SectionTitle>Questions fréquentes</SectionTitle>
          <View className="bg-surface-container-low rounded-2xl overflow-hidden">
            {faq.map((item, i) => {
              const open = openFaq === i;
              return (
                <View key={i} className={i < faq.length - 1 ? "border-b border-surface-container" : ""}>
                  <Pressable
                    onPress={() => setOpenFaq(open ? null : i)}
                    className="flex-row items-center px-4 py-4 active:bg-surface-container"
                  >
                    <Text className="text-on-surface text-sm font-semibold flex-1 pr-3">{item.q}</Text>
                    <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color="#94a3b8" />
                  </Pressable>
                  {open && (
                    <View className="px-4 pb-4">
                      <Text className="text-on-surface-variant text-sm leading-relaxed">{item.a}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <SectionTitle>Localisation</SectionTitle>
          <View className="rounded-2xl overflow-hidden bg-surface-container-low border border-surface-container">
            <View style={{ height: 200, backgroundColor: "#e5e7eb" }}>
              {coords ? (
                <MapView
                  provider={PROVIDER_DEFAULT}
                  style={{ width: "100%", height: "100%" }}
                  initialRegion={{
                    latitude: coords.lat,
                    longitude: coords.lon,
                    latitudeDelta: 0.04,
                    longitudeDelta: 0.04,
                  }}
                  pointerEvents="none"
                >
                  <Marker coordinate={{ latitude: coords.lat, longitude: coords.lon }} />
                </MapView>
              ) : (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator color="#2f6fb8" />
                </View>
              )}
              <Pressable
                onPress={openMap}
                className="absolute top-3 right-3 bg-white rounded-full w-9 h-9 items-center justify-center"
                style={{ shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}
              >
                <Ionicons name="open-outline" size={18} color="#2f6fb8" />
              </Pressable>
            </View>
            <Pressable
              onPress={openMap}
              className="px-4 py-3 flex-row items-center active:bg-surface-container"
            >
              <Ionicons name="location" size={18} color="#2f6fb8" />
              <Text className="text-on-surface text-sm font-semibold ml-2 flex-1">{listing.location}</Text>
              <Text className="text-primary text-xs font-bold">Ouvrir ›</Text>
            </Pressable>
          </View>

          {ad && (
            <>
              <SectionTitle>Publicité</SectionTitle>
              <Pressable
                onPress={() => { trackAd(ad.id, "click"); Linking.openURL(ad.destinationUrl).catch(() => {}); }}
                className="bg-surface-container-low border border-surface-container rounded-2xl overflow-hidden active:opacity-90"
              >
                {adImgAbs && (
                  <Image source={{ uri: adImgAbs }} style={{ width: "100%", aspectRatio: 16 / 9 }} contentFit="cover" />
                )}
                <View className="p-4">
                  <Text className="text-on-surface font-bold text-base" numberOfLines={1}>{ad.title}</Text>
                  <Text className="text-on-surface-variant text-sm mt-1" numberOfLines={2}>{ad.description}</Text>
                </View>
              </Pressable>
            </>
          )}
        </View>

        {/* Autres annonces du vendeur */}
        {related.sellerOthers.length > 0 && (
          <RelatedRow
            title={`Autres annonces de ${sellerName}`}
            data={related.sellerOthers}
            onPress={(l) => router.push(`/annonce/${l.id}`)}
          />
        )}

        {/* Annonces similaires */}
        {related.similar.length > 0 && (
          <RelatedRow
            title={listing.subcategory ? `Annonces similaires — ${listing.subcategory}` : `Annonces similaires en ${listing.category}`}
            data={related.similar}
            onPress={(l) => router.push(`/annonce/${l.id}`)}
          />
        )}
      </ScrollView>

      {/* Visionneuse plein écran */}
      <FullscreenPhotoViewer
        visible={galleryOpen}
        images={images}
        initialIndex={galleryIndex}
        onClose={() => setGalleryOpen(false)}
      />

      {/* CTA flottant — toujours visible (sauf pour l'auteur) */}
      {!isMine && (
        <View
          className="absolute bottom-0 left-0 right-0 bg-white border-t border-surface-container px-4 pt-3 pb-7 flex-row gap-2"
          style={{ shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: -2 }, elevation: 6 }}
        >
          <Pressable
            onPress={toggleFav}
            disabled={favBusy}
            className={`w-14 h-12 rounded-full items-center justify-center border-2 ${isFav ? "bg-red-50 border-red-200" : "bg-white border-surface-container"}`}
          >
            <Ionicons name={isFav ? "heart" : "heart-outline"} size={22} color={isFav ? "#ef4444" : "#1a1a1a"} />
          </Pressable>
          <Pressable
            onPress={contact}
            disabled={contactBusy}
            className="flex-1 bg-primary h-12 rounded-full flex-row items-center justify-center active:opacity-90"
          >
            {contactBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="chatbubble" size={16} color="#fff" />
                <Text className="text-white font-bold text-base ml-2">Message</Text>
              </>
            )}
          </Pressable>
          {listing.phone && !listing.hidePhone && (
            <Pressable
              onPress={callSeller}
              className="w-14 h-12 rounded-full items-center justify-center border-2 border-primary active:opacity-70"
            >
              <Ionicons name="call" size={20} color="#2f6fb8" />
            </Pressable>
          )}
        </View>
      )}
    </>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <View className="bg-surface-container px-3 py-1 rounded-full">
      <Text className="text-on-surface-variant text-xs font-semibold">{children}</Text>
    </View>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text className="text-on-surface text-base font-extrabold mt-7 mb-3">{children}</Text>;
}

function RelatedRow({
  title, data, onPress,
}: { title: string; data: RelatedListing[]; onPress: (l: RelatedListing) => void }) {
  return (
    <View className="mt-7">
      <Text className="text-on-surface text-base font-extrabold px-4 mb-3">{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}>
        {data.map((l) => {
          const img = firstImage(l.images);
          return (
            <Pressable
              key={l.id}
              onPress={() => onPress(l)}
              style={{ width: 160 }}
              className="bg-surface-container-low rounded-xl overflow-hidden active:opacity-80"
            >
              <View style={{ width: "100%", aspectRatio: 1 }} className="bg-surface-container">
                {img && <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" />}
              </View>
              <View className="px-2 pt-2 pb-3">
                <Text numberOfLines={2} className="text-on-surface text-sm font-semibold leading-snug">{l.title}</Text>
                <Text className="text-primary text-base font-extrabold mt-1">{formatPrice(l.price)}</Text>
                <Text numberOfLines={1} className="text-on-surface-variant text-xs">{l.location}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

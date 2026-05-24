import { useCallback, useEffect, useState } from "react";
import {
  ScrollView, View, Text, ActivityIndicator, Pressable,
  Dimensions, Alert, Share, Linking, Platform, ActionSheetIOS,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Polygon, Circle, PROVIDER_DEFAULT, type Region } from "react-native-maps";
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
  brand?: string | null;
  immoSurface?: number | null;
  immoRooms?: number | null;
  metadata?: string | Record<string, unknown> | null;
  favoritesCount?: number;
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
  const [favCount, setFavCount] = useState(0);
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
  const [cityBoundary, setCityBoundary] = useState<{ latitude: number; longitude: number }[][]>([]);
  const [cityRegion, setCityRegion] = useState<Region | null>(null);
  const [postalLabel, setPostalLabel] = useState<string>("");

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
        setFavCount(data.favoritesCount ?? 0);
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

  // Géocode + polygon ville via Nominatim — délimitation administrative inline.
  useEffect(() => {
    if (!listing?.location) return;
    let cancelled = false;

    type NomResult = {
      lat: string; lon: string;
      boundingbox?: [string, string, string, string];
      display_name?: string;
      address?: { postcode?: string; city?: string; town?: string; village?: string; municipality?: string };
      geojson?: { type: string; coordinates: number[][][] | number[][][][] };
    };

    const applyResult = (r: NomResult) => {
      const lat = parseFloat(r.lat);
      const lon = parseFloat(r.lon);
      setCoords({ lat, lon });
      if (r.boundingbox) {
        const [minLat, maxLat, minLon, maxLon] = r.boundingbox.map(parseFloat);
        setCityRegion({
          latitude: (minLat + maxLat) / 2,
          longitude: (minLon + maxLon) / 2,
          latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.4),
          longitudeDelta: Math.max(0.02, (maxLon - minLon) * 1.4),
        });
      }
      let gotPoly = false;
      if (r.geojson) {
        const g = r.geojson;
        if (g.type === "Polygon") {
          const rings = g.coordinates as number[][][];
          setCityBoundary(rings.map((ring) => ring.map(([lo, la]) => ({ latitude: la, longitude: lo }))));
          gotPoly = true;
        } else if (g.type === "MultiPolygon") {
          const polys = g.coordinates as number[][][][];
          setCityBoundary(polys.flatMap((p) => p.map((ring) => ring.map(([lo, la]) => ({ latitude: la, longitude: lo })))));
          gotPoly = true;
        }
      }
      const cityName = r.address?.city ?? r.address?.town ?? r.address?.village ?? r.address?.municipality;
      const postal = r.address?.postcode ? ` (${r.address.postcode})` : "";
      if (cityName) setPostalLabel(`${cityName}${postal}`);
      return gotPoly;
    };

    const parseLoc = (loc: string) => {
      const postalMatch = loc.match(/\b(\d{5})\b/);
      const postcode = postalMatch ? postalMatch[1] : "";
      // Retire code postal + parenthèses pour isoler le nom de ville
      const city = loc.replace(/\(.*?\)/g, "").replace(/\b\d{5}\b/g, "").replace(/[,·]/g, " ").trim();
      return { city, postcode };
    };

    (async () => {
      const { city, postcode } = parseLoc(listing.location);
      const common = "format=json&limit=1&polygon_geojson=1&polygon_threshold=0.001&addressdetails=1&countrycodes=fr";
      const headers = { "User-Agent": "DealAndCo/1.0 (contact@dealandcompany.fr)", "Accept-Language": "fr" };

      // 1) Requête structurée city= (+ postalcode) → vise la frontière administrative
      const structured =
        `https://nominatim.openstreetmap.org/search?${common}` +
        (city ? `&city=${encodeURIComponent(city)}` : "") +
        (postcode ? `&postalcode=${postcode}` : "");
      // 2) Repli requête texte libre
      const freeform = `https://nominatim.openstreetmap.org/search?${common}&q=${encodeURIComponent(listing.location)}`;

      for (const url of [structured, freeform]) {
        if (cancelled) return;
        try {
          const res = await fetch(url, { headers });
          const data = (await res.json()) as NomResult[];
          if (cancelled) return;
          if (data?.[0]) {
            const gotPoly = applyResult(data[0]);
            if (gotPoly) return; // polygone trouvé, on s'arrête
          }
        } catch { /* essaie l'URL suivante */ }
      }
    })();

    return () => { cancelled = true; };
  }, [listing?.location]);

  const toggleFav = async () => {
    if (!user) { router.push("/(auth)/login"); return; }
    if (!listing || favBusy) return;
    setFavBusy(true);
    const next = !isFav;
    setIsFav(next);
    setFavCount((c) => c + (next ? 1 : -1));
    try {
      await apiFetch("/api/favorites", {
        method: next ? "POST" : "DELETE",
        body: JSON.stringify({ listingId: listing.id }),
      });
    } catch {
      setIsFav(!next);
      setFavCount((c) => c + (next ? -1 : 1));
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
    // Track click sans bloquer
    apiFetch(`/api/listings/${listing.id}/click`, {
      method: "POST",
      auth: false,
      body: JSON.stringify({ type: "message" }),
    }).catch(() => {});

    // Navigation optimiste : route immédiate vers messages avec listingId,
    // l'écran messages crée/récupère la conversation côté serveur.
    router.push({
      pathname: "/messages/new",
      params: { listingId: listing.id, sellerId: listing.userId },
    });
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
              <Pressable onPress={openShare} className="px-2"><Ionicons name="share-outline" size={22} color="#1a1a1a" /></Pressable>
              {!isMine && (
                <Pressable onPress={toggleFav} disabled={favBusy} className="px-2 flex-row items-center">
                  <Text className="text-on-surface text-sm font-bold mr-1.5">{favCount}</Text>
                  <Ionicons name={isFav ? "heart" : "heart-outline"} size={22} color={isFav ? "#ef4444" : "#1a1a1a"} />
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

        {/* Bloc principal — hiérarchie : ligne 1 (gris discret) → titre fort → prix très gros */}
        <View className="p-4">
          <View className="flex-row items-center">
            <Text className="text-on-surface-variant text-xs">Publié {timeAgo(listing.createdAt)}</Text>
            <Text className="text-on-surface-variant text-xs mx-1.5">·</Text>
            <Text className="text-on-surface-variant text-xs flex-1" numberOfLines={1}>{listing.location}</Text>
          </View>
          <Text className="text-on-surface text-xl font-extrabold mt-1.5">{listing.title}</Text>
          <Text className="text-primary text-4xl font-extrabold mt-2">{formatPrice(listing.price)}</Text>

          <View className="mt-3 flex-row gap-2 flex-wrap">
            <Chip>{listing.category}</Chip>
            {listing.subcategory ? <Chip>{listing.subcategory}</Chip> : null}
          </View>

          {structuredSpecs.length > 0 && (() => {
            const KEY_COUNT = 8;
            const visibleSpecs = specsExpanded ? structuredSpecs : structuredSpecs.slice(0, KEY_COUNT);
            const extra = structuredSpecs.length - KEY_COUNT;
            return (
              <>
                <SectionTitle>Les informations clés</SectionTitle>
                <View className="flex-row flex-wrap -mx-1">
                  {visibleSpecs.map((sp, i) => (
                    <View key={`${sp.label}-${i}`} className="w-1/2 px-1 mb-2">
                      <View className="bg-surface-container-low rounded-xl p-3 flex-row items-center">
                        <View className="w-9 h-9 rounded-full bg-white items-center justify-center">
                          <Ionicons name={(sp.icon ?? "ellipse-outline") as keyof typeof Ionicons.glyphMap} size={16} color="#2f6fb8" />
                        </View>
                        <View className="ml-2.5 flex-1">
                          <Text className="text-on-surface-variant text-[11px] font-medium" numberOfLines={1}>{sp.label}</Text>
                          <Text className="text-on-surface text-sm font-bold" numberOfLines={1}>{sp.value}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
                {extra > 0 && (
                  <Pressable
                    onPress={() => setSpecsExpanded((v) => !v)}
                    className="mt-2 self-stretch border-2 border-primary rounded-full py-2.5 items-center active:opacity-70"
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
          <Text className="text-on-surface text-lg font-extrabold mb-3">{postalLabel || listing.location}</Text>
          <View className="rounded-2xl overflow-hidden bg-surface-container-low border border-surface-container">
            <View style={{ height: 240, backgroundColor: "#e5e7eb" }}>
              {coords ? (
                <MapView
                  provider={PROVIDER_DEFAULT}
                  style={{ width: "100%", height: "100%" }}
                  region={cityRegion ?? undefined}
                  initialRegion={cityRegion ?? {
                    latitude: coords.lat,
                    longitude: coords.lon,
                    latitudeDelta: 0.04,
                    longitudeDelta: 0.04,
                  }}
                  pointerEvents="none"
                >
                  {cityBoundary.length > 0 ? (
                    cityBoundary.map((ring, i) => (
                      <Polygon
                        key={i}
                        coordinates={ring}
                        strokeColor="#0e2742"
                        fillColor="rgba(47,111,184,0.18)"
                        strokeWidth={2}
                      />
                    ))
                  ) : (
                    <Circle
                      center={{ latitude: coords.lat, longitude: coords.lon }}
                      radius={2000}
                      strokeColor="#0e2742"
                      fillColor="rgba(47,111,184,0.18)"
                      strokeWidth={2}
                    />
                  )}
                </MapView>
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Skeleton width="100%" height={240} borderRadius={0} />
                </View>
              )}
              <Pressable
                onPress={openMap}
                className="absolute top-3 right-3 bg-white rounded-full w-10 h-10 items-center justify-center"
                style={{ shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}
              >
                <Ionicons name="expand" size={18} color="#2f6fb8" />
              </Pressable>
            </View>
          </View>

          {/* Vendeur — après localisation */}
          <SectionTitle>{listing.user.isPro ? "Vendeur professionnel" : "Vendeur"}</SectionTitle>
          <Pressable
            onPress={() => Alert.alert("Profil vendeur", "L'écran profil vendeur arrive bientôt.")}
            className="bg-surface-container-low rounded-2xl p-4 flex-row items-center active:opacity-80"
          >
            <View className="w-14 h-14 rounded-full overflow-hidden bg-surface-container">
              {listing.user.avatar ? (
                <Image source={{ uri: listing.user.avatar }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : (
                <View className="flex-1 items-center justify-center"><Ionicons name="person" size={24} color="#94a3b8" /></View>
              )}
            </View>
            <View className="flex-1 ml-3">
              <View className="flex-row items-center gap-2 flex-wrap">
                <Text className="text-on-surface text-base font-extrabold" numberOfLines={1}>{sellerName}</Text>
                {listing.user.isPro && (
                  <View className="border border-primary rounded-full px-2 py-0.5">
                    <Text className="text-primary text-[10px] font-bold">PRO</Text>
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
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </Pressable>

          {/* Conseil sécurité — compact */}
          <View className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3 flex-row items-start">
            <Ionicons name="shield-checkmark" size={16} color="#2563eb" />
            <Text className="text-blue-800 text-xs ml-2 flex-1 leading-relaxed">
              Rencontrez-vous dans un lieu public. Ne payez jamais avant d'avoir vu l'article.
            </Text>
          </View>

          {ad && (
            <Pressable
              onPress={() => { trackAd(ad.id, "click"); Linking.openURL(ad.destinationUrl).catch(() => {}); }}
              className="mt-6 bg-surface-container-low border border-surface-container rounded-2xl overflow-hidden flex-row active:opacity-90"
              style={{ height: 88 }}
            >
              {adImgAbs && (
                <Image source={{ uri: adImgAbs }} style={{ width: 88, height: 88 }} contentFit="cover" />
              )}
              <View className="flex-1 p-3 justify-center">
                <View className="flex-row items-center">
                  <Text className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">Sponsorisé</Text>
                </View>
                <Text className="text-on-surface font-bold text-sm mt-0.5" numberOfLines={1}>{ad.title}</Text>
                <Text className="text-on-surface-variant text-xs" numberOfLines={1}>{ad.description}</Text>
              </View>
            </Pressable>
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

      {/* CTA flottant — Voir le numéro + Message (style Leboncoin) */}
      {!isMine && (
        <View
          className="absolute bottom-0 left-0 right-0 bg-white border-t border-surface-container px-4 pt-3 pb-7 flex-row gap-2"
          style={{ shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: -2 }, elevation: 6 }}
        >
          {listing.phone && !listing.hidePhone ? (
            <Pressable
              onPress={callSeller}
              className="flex-1 h-12 rounded-full items-center justify-center border-2 border-primary bg-white active:opacity-70"
            >
              <Text className="text-primary font-bold text-base" numberOfLines={1}>
                {phoneShown ? listing.phone : "Voir le numéro"}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={toggleFav}
              disabled={favBusy}
              className={`flex-1 h-12 rounded-full items-center justify-center border-2 ${isFav ? "bg-red-50 border-red-200" : "bg-white border-primary"} active:opacity-70`}
            >
              <View className="flex-row items-center">
                <Ionicons name={isFav ? "heart" : "heart-outline"} size={18} color={isFav ? "#ef4444" : "#2f6fb8"} />
                <Text className={`font-bold text-base ml-2 ${isFav ? "text-red-600" : "text-primary"}`}>
                  {isFav ? "Sauvegardé" : "Sauvegarder"}
                </Text>
              </View>
            </Pressable>
          )}
          <Pressable
            onPress={contact}
            disabled={contactBusy}
            className="flex-1 bg-primary h-12 rounded-full flex-row items-center justify-center active:opacity-90"
          >
            {contactBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">Message</Text>
            )}
          </Pressable>
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

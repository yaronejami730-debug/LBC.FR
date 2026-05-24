import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polygon, Circle, PROVIDER_DEFAULT, type Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";

type Geometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};

type NominatimResp = {
  lat: string;
  lon: string;
  display_name: string;
  boundingbox: [string, string, string, string]; // [minLat, maxLat, minLon, maxLon]
  geojson?: Geometry;
}[];

function polyFromGeojson(geo: Geometry): { latitude: number; longitude: number }[][] {
  if (geo.type === "Polygon") {
    const rings = geo.coordinates as number[][][];
    return rings.map((ring) => ring.map(([lon, lat]) => ({ latitude: lat, longitude: lon })));
  }
  // MultiPolygon : aplatie tous les anneaux extérieurs
  const polys = geo.coordinates as number[][][][];
  return polys.flatMap((poly) => poly.map((ring) => ring.map(([lon, lat]) => ({ latitude: lat, longitude: lon }))));
}

export default function LocalisationScreen() {
  const router = useRouter();
  const { location } = useLocalSearchParams<{ location?: string }>();

  const [region, setRegion] = useState<Region | null>(null);
  const [marker, setMarker] = useState<{ latitude: number; longitude: number } | null>(null);
  const [boundary, setBoundary] = useState<{ latitude: number; longitude: number }[][]>([]);
  const [label, setLabel] = useState(location ?? "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!location) { setLoading(false); setError("Adresse manquante"); return; }
    let cancelled = false;

    (async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&polygon_geojson=1&q=${encodeURIComponent(location)}`;
        const res = await fetch(url, { headers: { "User-Agent": "DealAndCo/1.0" } });
        const data = (await res.json()) as NominatimResp;
        if (cancelled || !data?.[0]) {
          setError("Localisation introuvable");
          return;
        }
        const r = data[0];
        const lat = parseFloat(r.lat);
        const lon = parseFloat(r.lon);
        const [minLat, maxLat, minLon, maxLon] = r.boundingbox.map(parseFloat);
        setMarker({ latitude: lat, longitude: lon });
        setLabel(r.display_name.split(",").slice(0, 2).join(",").trim());
        setRegion({
          latitude: (minLat + maxLat) / 2,
          longitude: (minLon + maxLon) / 2,
          latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.4),
          longitudeDelta: Math.max(0.02, (maxLon - minLon) * 1.4),
        });
        if (r.geojson && (r.geojson.type === "Polygon" || r.geojson.type === "MultiPolygon")) {
          setBoundary(polyFromGeojson(r.geojson));
        }
      } catch {
        setError("Erreur de chargement de la carte");
      } finally {
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [location]);

  const initial = useMemo<Region>(() => region ?? { latitude: 46.6, longitude: 2.4, latitudeDelta: 8, longitudeDelta: 8 }, [region]);

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-row items-center px-3 py-2 border-b border-surface-container">
        <Pressable onPress={() => router.back()} hitSlop={10} className="p-1 active:opacity-60">
          <Ionicons name="chevron-back" size={26} color="#1a1a1a" />
        </Pressable>
        <View className="flex-1 ml-2">
          <Text className="text-on-surface text-base font-extrabold" numberOfLines={1}>{label || "Localisation"}</Text>
          <Text className="text-on-surface-variant text-[11px]">L'adresse exacte du vendeur n'est jamais affichée</Text>
        </View>
      </View>

      <View className="flex-1">
        <MapView
          provider={PROVIDER_DEFAULT}
          style={{ flex: 1 }}
          region={region ?? undefined}
          initialRegion={initial}
        >
          {marker && (
            boundary.length > 0 ? (
              boundary.map((ring, i) => (
                <Polygon
                  key={i}
                  coordinates={ring}
                  strokeColor="#2f6fb8"
                  fillColor="rgba(47,111,184,0.15)"
                  strokeWidth={2}
                />
              ))
            ) : (
              // Pas de polygone Nominatim : on dessine un cercle d'approximation 2 km
              <Circle
                center={marker}
                radius={2000}
                strokeColor="#2f6fb8"
                fillColor="rgba(47,111,184,0.15)"
                strokeWidth={2}
              />
            )
          )}
          {marker && <Marker coordinate={marker} pinColor="#2f6fb8" />}
        </MapView>

        {loading && (
          <View className="absolute inset-0 items-center justify-center bg-black/10">
            <ActivityIndicator color="#2f6fb8" />
          </View>
        )}
        {error && !loading && (
          <View className="absolute top-3 left-3 right-3 bg-red-50 border border-red-200 rounded-xl p-3">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

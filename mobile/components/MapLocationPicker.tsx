import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

export type LocationValue = {
  label: string;
  latitude: number;
  longitude: number;
};

type Props = {
  value: LocationValue | null;
  onChange: (v: LocationValue) => void;
};

const FRANCE_FALLBACK: Region = {
  latitude: 46.6,
  longitude: 2.4,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
  const p = places[0];
  if (!p) return "";
  const city = p.city ?? p.subregion ?? p.region ?? "";
  const postal = p.postalCode ? ` ${p.postalCode}` : "";
  return `${city}${postal}`.trim();
}

export function MapLocationPicker({ value, onChange }: Props) {
  const mapRef = useRef<MapView | null>(null);
  const [region, setRegion] = useState<Region>(
    value
      ? { latitude: value.latitude, longitude: value.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }
      : FRANCE_FALLBACK,
  );
  const [loadingLabel, setLoadingLabel] = useState(false);
  const [loadingGps, setLoadingGps] = useState(false);

  useEffect(() => {
    if (value) {
      const next = { latitude: value.latitude, longitude: value.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 };
      setRegion(next);
      mapRef.current?.animateToRegion(next, 350);
    }
  }, [value?.latitude, value?.longitude]);

  const useGps = async () => {
    setLoadingGps(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") { Alert.alert("Permission refusée", "Autorisez la localisation."); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const label = await reverseGeocode(lat, lng);
      onChange({ label, latitude: lat, longitude: lng });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Géolocalisation échouée");
    } finally {
      setLoadingGps(false);
    }
  };

  const onDragEnd = async (lat: number, lng: number) => {
    setLoadingLabel(true);
    try {
      const label = await reverseGeocode(lat, lng);
      onChange({ label, latitude: lat, longitude: lng });
    } finally {
      setLoadingLabel(false);
    }
  };

  return (
    <View>
      <View style={{ height: 220, borderRadius: 16, overflow: "hidden" }} className="bg-surface-container">
        <MapView
          ref={(r) => { mapRef.current = r; }}
          style={{ flex: 1 }}
          initialRegion={region}
          onRegionChangeComplete={setRegion}
        >
          {value && (
            <Marker
              draggable
              coordinate={{ latitude: value.latitude, longitude: value.longitude }}
              onDragEnd={(e) => onDragEnd(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}
              pinColor="#2f6fb8"
            />
          )}
        </MapView>
      </View>

      <View className="flex-row items-center mt-2 gap-2">
        <Pressable
          onPress={useGps}
          disabled={loadingGps}
          className={`flex-row items-center px-3 py-2 rounded-full ${loadingGps ? "bg-outline" : "bg-primary"}`}
        >
          {loadingGps ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="locate" size={14} color="#fff" />
              <Text className="text-white text-xs font-bold ml-1">Ma position</Text>
            </>
          )}
        </Pressable>
        <View className="flex-1">
          <Text className="text-on-surface text-sm font-semibold" numberOfLines={1}>
            {loadingLabel ? "Recherche…" : value?.label || "Touchez la carte ou utilisez le GPS"}
          </Text>
          {value && <Text className="text-on-surface-variant text-[11px]">Glissez le marqueur pour ajuster</Text>}
        </View>
      </View>
    </View>
  );
}

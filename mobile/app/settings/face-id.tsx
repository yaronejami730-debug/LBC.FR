import { useEffect, useState } from "react";
import { View, Text, Switch, ActivityIndicator, Alert } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

export const FACEID_PREF = "dealandco.pref.faceid";

export default function FaceIdScreen() {
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(false);
  const [label, setLabel] = useState("Face ID / Touch ID");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      const hasHw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) setLabel("Face ID");
      else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) setLabel("Touch ID / Empreinte");
      setSupported(hasHw && enrolled);
      const pref = await SecureStore.getItemAsync(FACEID_PREF);
      setEnabled(pref === "on");
      setLoading(false);
    })();
  }, []);

  const toggle = async (value: boolean) => {
    if (value) {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: "Activer le déverrouillage biométrique",
        cancelLabel: "Annuler",
      });
      if (!res.success) {
        Alert.alert("Échec", "Authentification biométrique non confirmée.");
        return;
      }
    }
    setEnabled(value);
    await SecureStore.setItemAsync(FACEID_PREF, value ? "on" : "off");
  };

  if (loading) {
    return <View className="flex-1 bg-surface items-center justify-center"><ActivityIndicator color="#2f6fb8" /></View>;
  }

  return (
    <View className="flex-1 bg-surface p-4">
      {supported ? (
        <>
          <View className="flex-row items-center justify-between bg-surface-container-low rounded-xl px-4 py-3">
            <View className="flex-1 mr-3">
              <Text className="text-on-surface font-semibold">{label}</Text>
              <Text className="text-on-surface-variant text-xs mt-0.5">
                Déverrouiller l'application avec votre biométrie
              </Text>
            </View>
            <Switch value={enabled} onValueChange={toggle} trackColor={{ true: "#2f6fb8" }} />
          </View>
          <Text className="text-on-surface-variant text-xs mt-3">
            La biométrie sera demandée à l'ouverture de l'application.
          </Text>
        </>
      ) : (
        <View className="bg-surface-container-low rounded-xl p-4">
          <Text className="text-on-surface-variant text-sm">
            Aucune biométrie configurée sur cet appareil. Activez Face ID / Touch ID dans les réglages de votre
            téléphone pour utiliser cette option.
          </Text>
        </View>
      )}
    </View>
  );
}

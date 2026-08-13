import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useAdminMode } from "@/lib/adminMode";
import { colors } from "@/lib/theme";

/**
 * Pile d'écrans du mode administrateur.
 *
 * Le garde-fou est double, et volontairement : ici, on empêche seulement
 * l'écran de s'ouvrir pour un compte qui n'a rien à y faire (confort, pas
 * sécurité). Le vrai verrou est côté serveur — chaque route `/api/mobile/admin`
 * revérifie le rôle, un mode local ne prouve rien.
 */
export default function AdminLayout() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { canSwitch, loading: modeLoading } = useAdminMode();

  useEffect(() => {
    if (loading || modeLoading) return;
    if (!user || !canSwitch) router.replace("/(tabs)/profile");
  }, [loading, modeLoading, user, canSwitch, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.onSurface },
        headerStyle: { backgroundColor: colors.surface },
        contentStyle: { backgroundColor: colors.app },
        headerBackTitle: "Retour",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Administration" }} />
      <Stack.Screen name="annonces" options={{ title: "Annonces à modérer" }} />
      <Stack.Screen name="signalements" options={{ title: "Signalements" }} />
      <Stack.Screen name="professionnels" options={{ title: "Professionnels" }} />
    </Stack>
  );
}

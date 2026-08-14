import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useAdminMode } from "@/lib/adminMode";
import { colors } from "@/lib/theme";

/**
 * Pile d'écrans du mode administrateur.
 *
 * Un écran par section de la barre latérale du site, avec le même titre. Le
 * garde-fou posé ici n'empêche que l'ouverture d'un écran pour un compte qui
 * n'a rien à y faire : le vrai verrou est côté serveur, où chaque route
 * `/api/mobile/admin` revérifie le rôle. Un mode local ne prouve rien.
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
      <Stack.Screen name="users" options={{ title: "Utilisateurs" }} />
      <Stack.Screen name="annonces" options={{ title: "Annonces" }} />
      <Stack.Screen name="support" options={{ title: "Support" }} />
      <Stack.Screen name="categories" options={{ title: "Catégories" }} />
      <Stack.Screen name="professionnels" options={{ title: "Professionnels" }} />
      <Stack.Screen name="verifications" options={{ title: "Vérifications pro" }} />
      <Stack.Screen name="client" options={{ title: "Fiche client" }} />
      <Stack.Screen name="securite" options={{ title: "Centre de sécurité" }} />
      <Stack.Screen name="signalements" options={{ title: "Signalements" }} />
      <Stack.Screen name="crm" options={{ title: "CRM" }} />
      <Stack.Screen name="annonceurs" options={{ title: "Annonceurs" }} />
      <Stack.Screen name="ads" options={{ title: "Publicités" }} />
      <Stack.Screen name="banniere" options={{ title: "Bannières" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
      <Stack.Screen name="behavioral" options={{ title: "Moteur comportemental" }} />
      <Stack.Screen name="recommandations" options={{ title: "Recommandations" }} />
      <Stack.Screen name="seo" options={{ title: "Indexation SEO" }} />
    </Stack>
  );
}

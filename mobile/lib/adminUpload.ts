import * as ImagePicker from "expo-image-picker";
import { API_BASE_URL } from "./config";
import { getToken } from "./tokenStore";

/**
 * Envoi d'une image depuis l'application vers le stockage du site.
 *
 * C'est la même route que le site (`/api/upload`) : même traitement, même
 * redimensionnement, même floutage de plaque. Une bannière créée depuis un
 * téléphone est donc rigoureusement identique à une bannière créée au bureau.
 */
export async function pickAndUpload(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error("Accès aux photos refusé.");

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.9,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const form = new FormData();
  // React Native accepte cette forme d'objet pour un fichier local ; le type
  // DOM ne la connaît pas, d'où la conversion explicite.
  form.append("file", {
    uri: asset.uri,
    name: asset.fileName ?? `photo-${Date.now()}.jpg`,
    type: asset.mimeType ?? "image/jpeg",
  } as unknown as Blob);

  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}/api/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? `Envoi impossible (${res.status})`);
  return data.url;
}

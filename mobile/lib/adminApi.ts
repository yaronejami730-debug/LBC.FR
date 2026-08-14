import { apiFetch } from "./api";

/**
 * Accès à l'administration depuis l'application.
 *
 * Deux points d'entrée seulement, qui recouvrent tout le back-office :
 *
 *   — `adminData(section)` lit ce qu'affiche la page correspondante du site ;
 *   — `adminAction(nom, ...args)` appelle **la fonction du site**, telle quelle.
 *
 * Aucune règle métier ne vit côté application : elle afficherait tôt ou tard
 * autre chose que le site, et c'est précisément ce qu'on veut éviter.
 */
export async function adminData<T = unknown>(
  section: string,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const query = Object.entries(params ?? {})
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  return apiFetch<T>(`/api/mobile/admin/data/${section}${query ? `?${query}` : ""}`);
}

export async function adminAction<T = unknown>(name: string, ...args: unknown[]): Promise<T> {
  const res = await apiFetch<{ ok: boolean; result: T }>("/api/mobile/admin/action", {
    method: "POST",
    body: JSON.stringify({ name, args }),
  });
  return res.result;
}

/**
 * Les sections du back-office, dans l'ordre exact de la barre latérale du
 * site. Un administrateur qui passe du navigateur au téléphone doit retrouver
 * les mêmes entrées, au même endroit, sous le même nom.
 */
import type { Ionicons } from "@expo/vector-icons";

export type AdminSection = {
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Le tableau de bord lui-même : exclu de la liste des sections. */
  exact?: boolean;
};

export const ADMIN_SECTIONS: AdminSection[] = [
  { href: "/admin", icon: "grid-outline", label: "Dashboard", exact: true },
  { href: "/admin/users", icon: "people-outline", label: "Utilisateurs" },
  { href: "/admin/annonces", icon: "list-outline", label: "Annonces" },
  { href: "/admin/support", icon: "headset-outline", label: "Support" },
  { href: "/admin/categories", icon: "options-outline", label: "Catégories" },
  { href: "/admin/professionnels", icon: "shield-checkmark-outline", label: "Professionnels" },
  { href: "/admin/verifications", icon: "document-text-outline", label: "Vérifications pro" },
  { href: "/admin/securite", icon: "shield-outline", label: "Centre de sécurité" },
  { href: "/admin/crm", icon: "briefcase-outline", label: "CRM" },
  { href: "/admin/annonceurs", icon: "storefront-outline", label: "Annonceurs" },
  { href: "/admin/ads", icon: "megaphone-outline", label: "Publicités" },
  { href: "/admin/banniere", icon: "image-outline", label: "Bannières" },
  { href: "/admin/notifications", icon: "notifications-outline", label: "Notifications" },
  { href: "/admin/behavioral", icon: "bulb-outline", label: "Moteur comportemental" },
  { href: "/admin/recommandations", icon: "navigate-outline", label: "Recommandations" },
  { href: "/admin/seo", icon: "search-outline", label: "Indexation SEO" },
];

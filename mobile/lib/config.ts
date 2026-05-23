import Constants from "expo-constants";

// Ordre de priorité :
// 1. EXPO_PUBLIC_API_URL (.env / shell) — surcharge explicite dev/staging.
// 2. apiBaseUrl dans app.json (extra) — défaut prod.
// 3. Fallback prod en dur.
//
// En dev local : créez mobile/.env avec EXPO_PUBLIC_API_URL=http://<ip-lan>:3000
// puis relancez `npx expo start --clear`. Sur simulateur iOS, `http://localhost:3000`
// suffit ; sur device physique, utilisez l'IP LAN de votre machine.
const ENV_URL = process.env.EXPO_PUBLIC_API_URL;

export const API_BASE_URL: string =
  ENV_URL ??
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  "https://www.dealandcompany.fr";

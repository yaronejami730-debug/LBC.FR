import Constants from "expo-constants";

export const API_BASE_URL: string =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  "https://www.dealandcompany.fr";

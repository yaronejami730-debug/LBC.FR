import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { apiFetch } from "./api";
import { setToken, clearToken, getToken } from "./tokenStore";
import { registerExpoPushToken, unregisterExpoPushToken } from "./push";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  isPro: boolean;
  emailVerified: boolean;
  companyName?: string | null;
  verified?: boolean | null;
  image?: string | null;
  avatar?: string | null;
  phoneNumber?: string | null;
  marketingConsent?: boolean | null;
};

type AppleCredentialInput = {
  identityToken: string;
  fullName?: { givenName?: string | null; familyName?: string | null } | null;
  email?: string | null;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithApple: (input: AppleCredentialInput) => Promise<void>;
  register: (input: { name: string; email: string; password: string; marketingConsent?: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) { setUser(null); return; }
    try {
      const { user } = await apiFetch<{ user: AuthUser }>("/api/mobile/auth/me");
      setUser(user);
    } catch {
      await clearToken();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const [pushToken, setPushToken] = useState<string | null>(null);

  // Si l'utilisateur est déjà connecté au démarrage, on enregistre quand même
  // le token Expo — il peut avoir changé depuis la dernière session.
  useEffect(() => {
    if (user && !pushToken) {
      registerExpoPushToken().then((t) => setPushToken(t)).catch(() => {});
    }
  }, [user, pushToken]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ token: string; user: AuthUser }>("/api/mobile/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      auth: false,
    });
    await setToken(data.token);
    setUser(data.user);
    registerExpoPushToken().then((t) => setPushToken(t)).catch(() => {});
  }, []);

  const loginWithApple = useCallback(async (input: AppleCredentialInput) => {
    const data = await apiFetch<{ token: string; user: AuthUser }>("/api/mobile/auth/apple", {
      method: "POST",
      body: JSON.stringify(input),
      auth: false,
    });
    await setToken(data.token);
    setUser(data.user);
    registerExpoPushToken().then((t) => setPushToken(t)).catch(() => {});
  }, []);

  const register = useCallback(async (input: { name: string; email: string; password: string; marketingConsent?: boolean }) => {
    const data = await apiFetch<{ token: string; user: AuthUser }>("/api/mobile/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
      auth: false,
    });
    await setToken(data.token);
    setUser(data.user);
    registerExpoPushToken().then((t) => setPushToken(t)).catch(() => {});
  }, []);

  const logout = useCallback(async () => {
    if (pushToken) await unregisterExpoPushToken(pushToken);
    setPushToken(null);
    await clearToken();
    setUser(null);
  }, [pushToken]);

  return <Ctx.Provider value={{ user, loading, login, loginWithApple, register, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}

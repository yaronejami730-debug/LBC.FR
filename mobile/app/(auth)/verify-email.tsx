import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

const CODE_LENGTH = 6;

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(60);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const setDigit = (idx: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    setError(null);
    if (clean.length > 1) {
      // Coller un code complet
      const next = clean.slice(0, CODE_LENGTH).split("");
      const padded = [...next, ...Array(CODE_LENGTH - next.length).fill("")];
      setDigits(padded);
      const lastIdx = Math.min(CODE_LENGTH - 1, next.length - 1);
      inputs.current[lastIdx]?.focus();
      if (next.length === CODE_LENGTH) submit(next.join(""));
      return;
    }
    const next = [...digits];
    next[idx] = clean;
    setDigits(next);
    if (clean && idx < CODE_LENGTH - 1) inputs.current[idx + 1]?.focus();
    if (next.every((d) => d) && next.join("").length === CODE_LENGTH) submit(next.join(""));
  };

  const submit = async (code: string) => {
    if (!user?.email) { setError("Session expirée. Reconnectez-vous."); return; }
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/verify-email", {
        method: "POST",
        body: JSON.stringify({ email: user.email, code }),
        auth: false,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await refresh();
      router.replace("/(tabs)");
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(e instanceof Error ? e.message : "Code invalide");
      setDigits(Array(CODE_LENGTH).fill(""));
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!user?.email || resendIn > 0) return;
    setResending(true);
    setError(null);
    try {
      await apiFetch("/api/verify-email/resend", {
        method: "POST",
        body: JSON.stringify({ email: user.email }),
        auth: false,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setResendIn(60);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Renvoi impossible");
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View className="flex-1 px-6 pt-8">
          <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-4">
            <Ionicons name="mail-open" size={28} color="#2f6fb8" />
          </View>
          <Text className="text-on-surface text-3xl font-extrabold mb-2">Vérifiez votre email</Text>
          <Text className="text-on-surface-variant text-sm leading-relaxed">
            Nous avons envoyé un code à 6 chiffres à{"\n"}
            <Text className="text-on-surface font-semibold">{user?.email ?? "votre adresse email"}</Text>
          </Text>

          <View className="flex-row justify-between mt-8 mb-3">
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(r) => { inputs.current[i] = r; }}
                value={d}
                onChangeText={(v) => setDigit(i, v)}
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === "Backspace" && !digits[i] && i > 0) {
                    inputs.current[i - 1]?.focus();
                  }
                }}
                keyboardType="number-pad"
                maxLength={1}
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                editable={!loading}
                className={`w-12 h-14 rounded-xl text-center text-on-surface text-2xl font-extrabold border-2 ${d ? "border-primary bg-primary/5" : "border-surface-container bg-white"}`}
              />
            ))}
          </View>

          {loading && <ActivityIndicator color="#2f6fb8" className="mt-2" />}
          {error && <Text className="text-red-600 text-sm mt-2">{error}</Text>}

          <View className="mt-8 flex-row items-center justify-center">
            <Text className="text-on-surface-variant text-sm">Pas reçu ? </Text>
            <Pressable onPress={resend} disabled={resendIn > 0 || resending}>
              <Text className={`text-sm font-bold ${resendIn > 0 ? "text-outline" : "text-primary"}`}>
                {resending ? "…" : resendIn > 0 ? `Renvoyer (${resendIn}s)` : "Renvoyer le code"}
              </Text>
            </Pressable>
          </View>

          <Pressable onPress={() => router.replace("/(tabs)")} className="mt-12 self-center">
            <Text className="text-on-surface-variant text-sm">Plus tard</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import { Platform, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAuth } from "@/lib/auth";

type Props = {
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

export function AppleSignInButton({ onSuccess, onError }: Props) {
  const { loginWithApple } = useAuth();

  if (Platform.OS !== "ios") return null;

  return (
    <View style={{ width: "100%", height: 48, marginTop: 12 }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={999}
        style={{ width: "100%", height: 48 }}
        onPress={async () => {
          try {
            const credential = await AppleAuthentication.signInAsync({
              requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
              ],
            });
            if (!credential.identityToken) {
              onError?.("Apple n'a pas renvoyé d'identifiant. Réessayez.");
              return;
            }
            await loginWithApple({
              identityToken: credential.identityToken,
              fullName: credential.fullName,
              email: credential.email,
            });
            onSuccess?.();
          } catch (e: any) {
            if (e?.code === "ERR_REQUEST_CANCELED") return;
            onError?.(e instanceof Error ? e.message : "Connexion Apple impossible");
          }
        }}
      />
    </View>
  );
}

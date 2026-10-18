import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { bindAppFocus, createQueryClient } from "@/api/queryClient";
import { SessionProvider, useSession } from "@/auth/SessionProvider";
import { ClubThemeProvider } from "@/design/ClubTheme";
import { colors } from "@/design";
import { RefusedClubNotices } from "@/navigation/RefusedClubNotices";
import { RefusedSessionRedirect } from "@/navigation/RefusedSessionRedirect";
import { PushBridge } from "@/push/PushBridge";

// Splash maintenu pendant la lecture du trousseau : pas de flash connexion → accueil.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function ThemedApp() {
  const { status, club } = useSession();
  useEffect(() => {
    if (status !== "BOOTING") void SplashScreen.hideAsync().catch(() => undefined);
  }, [status]);
  if (status === "BOOTING") return null;
  return (
    <ClubThemeProvider accentColor={club?.accentColor}>
      <StatusBar style="dark" />
      <PushBridge />
      <RefusedSessionRedirect />
      <RefusedClubNotices />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </ClubThemeProvider>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  useEffect(() => bindAppFocus(), []);
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ThemedApp />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/api/endpoints/auth";
import { queryKeys } from "@/api/queryKeys";
import { useSession } from "@/auth/SessionProvider";
import { Banner, Button, Screen } from "@/components/ui";
import { ClubThemeProvider } from "@/design/ClubTheme";
import { LicensedAccessGate } from "@/features/licensed-access/LicensedAccessGate";
import { LicensedBackdrop } from "@/features/licensed-access/LicensedBackdrop";
import { moduleForRoute } from "@/features/licensed-access/modules";
import { SsoContinue } from "@/features/licensed-access/SsoContinue";
import { peekPendingDestination } from "@/linking/pendingDestination";
import { colors, spacing } from "@/design";

/**
 * Connexion à un club = l'accès réservé aux licenciés (porte commune à tous
 * les modules, contexte d'après la page demandée) : on se retrouve par son
 * nom (lien par email), ou en un geste si déjà connecté au site dans Safari.
 */
export default function ClubLoginScreen() {
  const { clubSlug = "" } = useLocalSearchParams<{ clubSlug: string }>();
  const session = useSession();
  const club = useQuery({ queryKey: queryKeys.club(clubSlug), queryFn: () => authApi.club(clubSlug), enabled: !!clubSlug });
  const { refusalRedirect, acknowledgeRedirect } = session;
  // L'identification du club refusé est à l'écran : plus de renvoi automatique.
  useEffect(() => {
    if (refusalRedirect && refusalRedirect === clubSlug) acknowledgeRedirect();
  }, [refusalRedirect, clubSlug, acknowledgeRedirect]);
  const pending = peekPendingDestination();
  const name = club.data?.name ?? clubSlug;

  return (
    <ClubThemeProvider accentColor={club.data?.accentColor}>
      <Screen>
        <View pointerEvents="none" style={styles.backdrop}>
          <LicensedBackdrop />
        </View>
        <Button label="Retour" variant="ghost" icon={<Ionicons name="chevron-back" size={18} color={colors.muted} />} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={styles.back} />
        {pending?.clubSlug === clubSlug ? <Banner tone="info" message="Après la connexion, tu arriveras directement sur la page demandée." /> : null}
        <LicensedAccessGate module={moduleForRoute(pending?.clubSlug === clubSlug ? pending.route : null)} clubSlug={clubSlug} clubName={name} logoUrl={club.data?.logoUrl ?? null} accentColor={club.data?.accentColor} />
        <SsoContinue clubSlug={clubSlug} />
      </Screen>
    </ClubThemeProvider>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: "flex-start", paddingHorizontal: 0 },
  backdrop: { position: "absolute", top: -spacing.md, left: -spacing.gutter, right: -spacing.gutter, height: 980 },
});

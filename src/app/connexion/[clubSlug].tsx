import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/api/endpoints/auth";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useSession } from "@/auth/SessionProvider";
import { SsoCancelled } from "@/auth/callback";
import { AppText, Banner, Button, Screen } from "@/components/ui";
import { ClubBadge } from "@/features/onboarding/ClubBadge";
import { ClubThemeProvider } from "@/design/ClubTheme";
import { IdentifyFlow } from "@/features/identify/IdentifyFlow";
import { peekPendingDestination } from "@/linking/pendingDestination";
import { destinationAfterLogin } from "@/navigation/after-login";
import { colors, spacing } from "@/design";

/** Connexion à un club : on se retrouve par son nom (lien par email), ou en un geste si déjà connecté au site dans Safari. */
export default function ClubLoginScreen() {
  const { clubSlug = "" } = useLocalSearchParams<{ clubSlug: string }>();
  const session = useSession();
  const club = useQuery({ queryKey: queryKeys.club(clubSlug), queryFn: () => authApi.club(clubSlug), enabled: !!clubSlug });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = peekPendingDestination();
  const name = club.data?.name ?? clubSlug;

  async function sso() {
    setBusy(true);
    setError(null);
    try {
      // La destination d'origine éventuelle est gardée côté app (destinationAfterLogin).
      const redirect = await session.ssoLogin(clubSlug, null);
      router.replace(destinationAfterLogin(clubSlug, redirect));
    } catch (e) {
      if (!(e instanceof SsoCancelled)) setError(e instanceof Error && e.name === "SsoInvalid" ? e.message : humanMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ClubThemeProvider accentColor={club.data?.accentColor}>
      <Screen>
        <Button label="Changer de club" variant="ghost" icon={<Ionicons name="chevron-back" size={18} color={colors.muted} />} onPress={() => (router.canGoBack() ? router.back() : router.replace("/bienvenue"))} style={styles.back} />
        <View style={styles.header}>
          <ClubBadge name={name} logoUrl={club.data?.logoUrl ?? null} accentColor={club.data?.accentColor} size={72} />
          <AppText variant="eyebrow" tone="muted">
            {name}
          </AppText>
          <AppText variant="display" accessibilityRole="header" style={styles.center}>
            Qui es-tu ?
          </AppText>
        </View>
        {pending?.clubSlug === clubSlug ? <Banner tone="info" message="Après la connexion, tu arriveras directement sur la page demandée." /> : null}
        {error ? <Banner tone="danger" message={error} /> : null}
        <IdentifyFlow clubSlug={clubSlug} />
        <View style={styles.or}>
          <View style={styles.rule} />
          <AppText variant="meta" tone="subtle">
            ou
          </AppText>
          <View style={styles.rule} />
        </View>
        <Button
          label="Déjà connecté sur le site ? Continuer"
          variant="secondary"
          icon={<Ionicons name="compass-outline" size={18} color={colors.foreground} />}
          loading={busy}
          onPress={() => void sso()}
          fullWidth
        />
      </Screen>
    </ClubThemeProvider>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: "flex-start", paddingHorizontal: 0 },
  header: { alignItems: "center", gap: spacing.sm, paddingTop: spacing.sm },
  center: { textAlign: "center" },
  or: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
});

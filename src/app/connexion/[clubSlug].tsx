import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/api/endpoints/auth";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useSession } from "@/auth/SessionProvider";
import { SsoCancelled } from "@/auth/callback";
import { AppText, Banner, Button, Screen } from "@/components/ui";
import { PasteLink } from "@/features/auth/PasteLink";
import { IdentifyFlow } from "@/features/identify/IdentifyFlow";
import { peekPendingDestination } from "@/linking/pendingDestination";
import { destinationAfterLogin } from "@/navigation/after-login";
import { spacing } from "@/design";

/** Connexion à un club : Safari (un geste si déjà connecté au site) ou lien par email. */
export default function ClubLoginScreen() {
  const { clubSlug = "" } = useLocalSearchParams<{ clubSlug: string }>();
  const session = useSession();
  const club = useQuery({ queryKey: queryKeys.club(clubSlug), queryFn: () => authApi.club(clubSlug), enabled: !!clubSlug });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"choice" | "email">("choice");
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
    <Screen>
      <Button label="Changer de club" variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace("/bienvenue"))} style={styles.back} />
      <AppText variant="title" accessibilityRole="header">
        {name}
      </AppText>
      {pending?.clubSlug === clubSlug ? <Banner tone="info" message="Après la connexion, tu arriveras directement sur la page demandée." /> : null}
      {error ? <Banner tone="danger" message={error} /> : null}
      {mode === "choice" ? (
        <View style={styles.choices}>
          <Button label="Continuer avec Ball Manager" size="lg" loading={busy} onPress={() => void sso()} fullWidth />
          <AppText variant="meta" tone="muted">
            Déjà connecté sur le site Ball Manager dans Safari ? Continue en un geste. Sinon, reçois ton lien par email : il ouvrira directement l&apos;app.
          </AppText>
          <Button label="Recevoir un lien de connexion" variant="secondary" size="lg" onPress={() => setMode("email")} fullWidth />
          <PasteLink />
        </View>
      ) : (
        <IdentifyFlow clubSlug={clubSlug} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ back: { alignSelf: "flex-start", paddingHorizontal: 0 }, choices: { gap: spacing.md } });

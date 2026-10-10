import { useEffect } from "react";
import { router, Stack, useLocalSearchParams, usePathname } from "expo-router";
import { useSession } from "@/auth/SessionProvider";
import { AppText, Button, Card, Screen } from "@/components/ui";
import { setPendingDestination } from "@/linking/pendingDestination";
import { colors } from "@/design";

/**
 * Lien vers un club : membre → bascule automatique sur ce club ; sinon
 * « Accès refusé » avec la possibilité de se connecter à ce club (la
 * destination est conservée).
 */
export default function ClubGateLayout() {
  const { clubSlug = "" } = useLocalSearchParams<{ clubSlug: string }>();
  const pathname = usePathname();
  const { state, setActiveClub } = useSession();
  const member = !!state.clubs[clubSlug];

  useEffect(() => {
    if (member && state.active !== clubSlug) void setActiveClub(clubSlug);
  }, [member, clubSlug, state.active, setActiveClub]);

  if (!member) {
    return (
      <Screen>
        <Card>
          <AppText variant="headline">Accès réservé</AppText>
          <AppText variant="callout" tone="muted">
            Ce lien concerne un club auquel cet iPhone n&apos;est pas connecté.
          </AppText>
          <Button
            label="Se connecter à ce club"
            onPress={() => {
              setPendingDestination({ clubSlug, route: pathname });
              router.replace(`/connexion/${clubSlug}`);
            }}
            fullWidth
          />
          <Button label="Retour à l'accueil" variant="ghost" onPress={() => router.replace("/")} />
        </Card>
      </Screen>
    );
  }
  if (state.active !== clubSlug) return null;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}

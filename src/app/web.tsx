import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { AppText, Button, Card, Screen } from "@/components/ui";

/**
 * Fonction disponible sur le site uniquement (administration, espace par
 * compte) : assumé clairement, jamais présenté comme un écran de l'app.
 */
export default function WebOnlyScreen() {
  const { url = "", reason = "" } = useLocalSearchParams<{ url: string; reason: string }>();
  const safe = /^https:\/\/(www\.)?ball-manager\.fr\//.test(url) ? url : null;
  return (
    <Screen>
      <Card>
        <AppText variant="headline">Disponible sur le site</AppText>
        <AppText variant="callout" tone="muted">
          {reason || "Cette page n'existe pas encore dans l'app."}
        </AppText>
        {safe ? <Button label="Ouvrir sur ball-manager.fr" onPress={() => void WebBrowser.openBrowserAsync(safe)} fullWidth /> : null}
        <Button label="Retour" variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      </Card>
    </Screen>
  );
}

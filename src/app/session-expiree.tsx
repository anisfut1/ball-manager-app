import { router } from "expo-router";
import { AppText, Button, Card, Screen } from "@/components/ui";

/** Toutes les sessions ont été refusées (lien réinitialisé par le club, 180 jours sans usage). */
export default function SessionExpiredScreen() {
  return (
    <Screen>
      <Card>
        <AppText variant="headline">Reconnecte-toi</AppText>
        <AppText variant="callout" tone="muted">
          Ta connexion à Ball Manager n&apos;est plus valable sur cet iPhone (lien renouvelé par le club ou longue inactivité). Tes données ne sont pas perdues.
        </AppText>
        <Button label="Se reconnecter" onPress={() => router.replace("/bienvenue")} fullWidth />
      </Card>
    </Screen>
  );
}

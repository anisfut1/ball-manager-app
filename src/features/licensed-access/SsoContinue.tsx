import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { humanMessage } from "@/api/errors";
import { useSession } from "@/auth/SessionProvider";
import { SsoCancelled } from "@/auth/callback";
import { routeAfterSso } from "@/auth/sso-outcome";
import { AppText, Banner, Button } from "@/components/ui";
import { colors, spacing } from "@/design";

/** « ou » + connexion en un geste quand on est déjà connecté au site dans Safari. */
export function SsoContinue({ clubSlug }: { clubSlug: string }) {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sso() {
    setBusy(true);
    setError(null);
    try {
      // La destination d'origine éventuelle est gardée côté app (destinationAfterLogin).
      const route = routeAfterSso(await session.ssoLogin(clubSlug, null), clubSlug);
      if (route) router.replace(route);
    } catch (e) {
      if (!(e instanceof SsoCancelled)) setError(e instanceof Error && e.name === "SsoInvalid" ? e.message : humanMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <View style={styles.or}>
        <View style={styles.rule} />
        <AppText variant="meta" tone="subtle">
          ou
        </AppText>
        <View style={styles.rule} />
      </View>
      {error ? <Banner tone="danger" message={error} /> : null}
      <Button label="Déjà connecté sur le site ? Continuer" variant="secondary" icon={<Ionicons name="compass-outline" size={18} color={colors.foreground} />} loading={busy} onPress={() => void sso()} fullWidth />
    </>
  );
}

const styles = StyleSheet.create({
  or: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
});

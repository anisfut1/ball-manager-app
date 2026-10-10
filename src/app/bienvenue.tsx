import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/api/endpoints/auth";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { AppText, Card, CardSkeletons, ErrorState, ListRow, Screen, TextField } from "@/components/ui";
import { PasteLink } from "@/features/auth/PasteLink";
import { spacing } from "@/design";

/** Choix du club (une app pour tous les clubs Ball Manager). */
export default function WelcomeScreen() {
  const clubs = useQuery({ queryKey: queryKeys.clubs, queryFn: authApi.listClubs });
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (clubs.data?.clubs ?? []).filter((c) => !needle || c.name.toLowerCase().includes(needle));
  }, [clubs.data, q]);

  return (
    <Screen>
      <View style={styles.hero}>
        <Image source={require("../../assets/images/icon.png")} style={styles.logo} accessibilityIgnoresInvertColors />
        <AppText variant="display">Ball Manager</AppText>
        <AppText variant="callout" tone="muted" style={styles.center}>
          Convocations, entraînements et vie du club, au même endroit.
        </AppText>
      </View>
      <Card>
        <AppText variant="headline" accessibilityRole="header">
          Ton club
        </AppText>
        <TextField label="Rechercher un club" value={q} onChangeText={setQ} autoCorrect={false} returnKeyType="search" />
        {clubs.isPending ? <CardSkeletons count={1} /> : null}
        {clubs.error ? <ErrorState message={humanMessage(clubs.error)} onRetry={() => void clubs.refetch()} /> : null}
        {filtered.map((c) => (
          <ListRow key={c.slug} title={c.name} onPress={() => router.push(`/connexion/${c.slug}`)} accessibilityHint="Se connecter à ce club" />
        ))}
      </Card>
      <PasteLink />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: spacing.sm, paddingTop: spacing.xxl },
  logo: { width: 72, height: 72, borderRadius: 18 },
  center: { textAlign: "center" },
});

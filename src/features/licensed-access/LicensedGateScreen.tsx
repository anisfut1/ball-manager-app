import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, usePathname } from "expo-router";
import { useCurrentClub } from "@/club/CurrentClubProvider";
import { Screen } from "@/components/ui";
import { spacing } from "@/design";
import { setPendingDestination } from "@/linking/pendingDestination";
import { ClubHeader } from "@/features/home/ClubHeader";
import { LicensedAccessGate } from "./LicensedAccessGate";
import { LicensedBackdrop } from "./LicensedBackdrop";
import { SsoContinue } from "./SsoContinue";
import type { LicensedAccessModuleId } from "./modules";

/**
 * Page réservée ouverte sans être reconnu (onglet Accueil, Équipe, Tables,
 * Dérogations…) : la porte « Accès réservé aux licenciés » à la place du
 * contenu, sous l'en-tête du club — comme l'espace public du web.
 * `stacked` : écran empilé (lien profond), avec bouton retour.
 */
export function LicensedGateScreen({ module, stacked = false }: { module: LicensedAccessModuleId; stacked?: boolean }) {
  const club = useCurrentClub();
  const pathname = usePathname();
  // Lien profond vers une page réservée : on y revient après l'identification.
  useEffect(() => {
    if (stacked) setPendingDestination({ clubSlug: club.slug, route: pathname });
  }, [stacked, club.slug, pathname]);
  return (
    <Screen edges={stacked ? [] : undefined}>
      {stacked ? <Stack.Screen options={{ headerShown: true, title: "", headerBackTitle: "Retour", headerShadowVisible: false, headerTransparent: false }} /> : null}
      <View pointerEvents="none" style={styles.backdrop}>
        <LicensedBackdrop />
      </View>
      {stacked ? null : <ClubHeader />}
      <LicensedAccessGate module={module} clubSlug={club.slug} clubName={club.name} logoUrl={club.logoUrl} accentColor={club.accentColor} />
      <SsoContinue clubSlug={club.slug} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", top: -spacing.md, left: -spacing.gutter, right: -spacing.gutter, height: 980 },
});

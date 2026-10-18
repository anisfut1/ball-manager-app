import { StyleSheet, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/auth/SessionProvider";
import { Banner } from "@/components/ui";
import { spacing } from "@/design";

/**
 * Avis non bloquants « Ta session {club} a expiré. » : un par club refusé, tant
 * que la personne ne s'est pas identifiée à nouveau et n'a pas fermé l'avis.
 * Ils ne déplacent jamais l'utilisateur ; l'avis d'un club n'est pas répété sur
 * son propre écran d'identification.
 */
export function RefusedClubNotices() {
  const { refusedClubs, dismissRefusal } = useSession();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const visible = refusedClubs.filter((c) => pathname !== `/connexion/${c.clubSlug}`);
  if (visible.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={[styles.overlay, { top: insets.top + spacing.sm }]}>
      {visible.map((c) => (
        <Banner key={c.clubSlug} tone="warning" message={`Ta session ${c.clubName} a expiré.`} action={{ label: "Se reconnecter", onPress: () => router.push(`/connexion/${c.clubSlug}`) }} onClose={() => dismissRefusal(c.clubSlug)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", left: spacing.gutter, right: spacing.gutter, gap: spacing.sm, zIndex: 10 },
});

import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@/design";
import { AppText } from "./AppText";
import { Button } from "./Button";

export function EmptyState({ icon = "checkmark-done-outline", title, message }: { icon?: keyof typeof Ionicons.glyphMap; title: string; message?: string }) {
  return (
    <View style={styles.box} accessibilityRole="summary">
      <Ionicons name={icon} size={28} color={colors.subtle} />
      <AppText variant="headline" style={styles.center}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="callout" tone="muted" style={styles.center}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

/** Erreur humaine + réessayer. Jamais d'écran blanc. */
export function ErrorState({ title = "Impossible de charger", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={28} color={colors.subtle} />
      <AppText variant="headline" style={styles.center}>
        {title}
      </AppText>
      <AppText variant="callout" tone="muted" style={styles.center}>
        {message}
      </AppText>
      {onRetry ? <Button label="Réessayer" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  center: { textAlign: "center" },
});

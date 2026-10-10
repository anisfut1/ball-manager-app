import { StyleSheet, View, type ViewProps } from "react-native";
import { colors, radius, shadows, spacing } from "@/design";

/** Carte signature : surface blanche, filet fin, ombre courte. */
export function Card({ style, padded = true, ...props }: ViewProps & { padded?: boolean }) {
  return <View style={[styles.card, padded && styles.padded, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceRaised, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadows.card },
  padded: { padding: spacing.lg, gap: spacing.md },
});

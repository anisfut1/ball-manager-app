import { Pressable, StyleSheet, View } from "react-native";
import type { ReactNode } from "react";
import { colors, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { AppText } from "./AppText";
import { Card } from "./Card";

/**
 * Carte de l'Action Center : « LINA · U15F » / titre / détails / réponse.
 * Le liseré d'accent signale ce qui attend une réponse.
 */
export function ActionCard({ eyebrow, title, children, pending = false, footer, onPress }: { eyebrow: string; title: string; children?: ReactNode; pending?: boolean; footer?: ReactNode; onPress?: () => void }) {
  const accent = useClubAccent();
  const head = (
    <>
      <AppText variant="eyebrow" color={accent.text} numberOfLines={1}>
        {eyebrow}
      </AppText>
      <AppText variant="headline">{title}</AppText>
    </>
  );
  return (
    <Card style={[pending && { borderLeftWidth: 3, borderLeftColor: accent.accent }]}>
      {onPress ? (
        <Pressable accessibilityRole="button" accessibilityHint="Ouvre le détail" onPress={onPress} style={({ pressed }) => [styles.head, pressed && styles.pressed]}>
          {head}
        </Pressable>
      ) : (
        <View style={styles.head}>{head}</View>
      )}
      {children}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs },
  pressed: { opacity: 0.7 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md },
});

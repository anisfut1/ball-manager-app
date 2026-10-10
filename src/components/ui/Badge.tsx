import { StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "@/design";
import { AppText } from "./AppText";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceMuted, fg: colors.muted },
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  info: { bg: colors.infoSoft, fg: colors.info },
};

export function Badge({ label, tone = "neutral" }: { label: string; tone?: BadgeTone }) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <AppText variant="meta" color={t.fg} style={styles.text} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.pill },
  text: { fontWeight: "600" },
});

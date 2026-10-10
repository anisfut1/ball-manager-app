import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/design";
import { AppText } from "./AppText";

export type BannerTone = "info" | "success" | "warning" | "danger";
const TONES: Record<BannerTone, { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  info: { bg: colors.infoSoft, fg: colors.info, icon: "information-circle-outline" },
  success: { bg: colors.successSoft, fg: colors.success, icon: "checkmark-circle-outline" },
  warning: { bg: colors.warningSoft, fg: colors.warning, icon: "alert-circle-outline" },
  danger: { bg: colors.dangerSoft, fg: colors.danger, icon: "close-circle-outline" },
};

/** Message en ligne (succès, erreur, information). */
export function Banner({ tone = "info", message }: { tone?: BannerTone; message: string }) {
  const t = TONES[tone];
  return (
    <View style={[styles.box, { backgroundColor: t.bg }]} accessibilityRole={tone === "danger" ? "alert" : "text"} accessibilityLiveRegion="polite">
      <Ionicons name={t.icon} size={18} color={t.fg} />
      <AppText variant="callout" color={t.fg} style={styles.text}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", padding: spacing.md, borderRadius: radius.md },
  text: { flex: 1 },
});

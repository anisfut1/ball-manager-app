import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, TOUCH_TARGET } from "@/design";
import { AppText } from "./AppText";

export type BannerTone = "info" | "success" | "warning" | "danger";
const TONES: Record<BannerTone, { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  info: { bg: colors.infoSoft, fg: colors.info, icon: "information-circle-outline" },
  success: { bg: colors.successSoft, fg: colors.success, icon: "checkmark-circle-outline" },
  warning: { bg: colors.warningSoft, fg: colors.warning, icon: "alert-circle-outline" },
  danger: { bg: colors.dangerSoft, fg: colors.danger, icon: "close-circle-outline" },
};

/** Message en ligne (succès, erreur, information), avec au besoin une action et un bouton de fermeture. */
export function Banner({ tone = "info", message, action, onClose }: { tone?: BannerTone; message: string; action?: { label: string; onPress: () => void }; onClose?: () => void }) {
  const t = TONES[tone];
  return (
    <View style={[styles.box, { backgroundColor: t.bg }]} accessibilityRole={tone === "danger" ? "alert" : "text"} accessibilityLiveRegion="polite">
      <Ionicons name={t.icon} size={18} color={t.fg} />
      <View style={styles.body}>
        <AppText variant="callout" color={t.fg}>
          {message}
        </AppText>
        {action ? (
          <Pressable accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} hitSlop={spacing.sm} style={styles.action}>
            <AppText variant="callout" color={t.fg} style={styles.actionLabel}>
              {action.label}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {onClose ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onClose} hitSlop={spacing.sm} style={styles.close}>
          <Ionicons name="close" size={18} color={t.fg} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", padding: spacing.md, borderRadius: radius.md },
  body: { flex: 1, gap: spacing.xs },
  action: { alignSelf: "flex-start", minHeight: TOUCH_TARGET / 2, justifyContent: "center" },
  actionLabel: { fontWeight: "700", textDecorationLine: "underline" },
  close: { width: TOUCH_TARGET / 2, height: TOUCH_TARGET / 2, alignItems: "center", justifyContent: "center" },
});

import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { colors, radius, spacing, TOUCH_TARGET } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { AppText } from "./AppText";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  label: string;
  variant?: ButtonVariant;
  size?: "md" | "lg";
  icon?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, variant = "primary", size = "md", icon, loading = false, fullWidth = false, disabled, onPress, style, ...props }: ButtonProps) {
  const accent = useClubAccent();
  const inactive = disabled || loading;
  const palette = {
    primary: { bg: accent.accent, fg: accent.ink, border: "transparent" },
    secondary: { bg: colors.surfaceRaised, fg: colors.foreground, border: colors.borderStrong },
    ghost: { bg: "transparent", fg: accent.text, border: "transparent" },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: "transparent" },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      disabled={inactive}
      onPress={(e) => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        size === "lg" && styles.large,
        fullWidth && styles.full,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.55 : pressed ? 0.82 : 1 },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <AppText variant="bodyStrong" color={palette.fg} numberOfLines={1}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: TOUCH_TARGET, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  large: { minHeight: 52, borderRadius: radius.lg },
  full: { alignSelf: "stretch" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
});

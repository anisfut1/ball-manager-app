import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { colors, MAX_FONT_SCALE, radius, spacing, TOUCH_TARGET, typography } from "@/design";
import { AppText } from "./AppText";

export function TextField({ label, hint, error, style, ...props }: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  return (
    <View style={styles.field}>
      <AppText variant="meta" tone="muted" style={styles.label}>
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.subtle}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[styles.input, error ? styles.invalid : null, style]}
        {...props}
      />
      {error ? (
        <AppText variant="meta" tone="danger">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="meta" tone="subtle">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { fontWeight: "600" },
  input: { ...typography.body, minHeight: TOUCH_TARGET, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceRaised, color: colors.foreground },
  invalid: { borderColor: colors.danger },
});

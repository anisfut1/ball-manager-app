import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { colors, spacing, TOUCH_TARGET } from "@/design";
import { AppText } from "./AppText";

export interface ListRowProps {
  title: string;
  subtitle?: string | null;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityHint?: string;
}

export function ListRow({ title, subtitle, leading, trailing, onPress, accessibilityHint }: ListRowProps) {
  const content = (
    <View style={styles.row}>
      {leading}
      <View style={styles.text}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="meta" tone="muted" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.subtle} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" accessibilityHint={accessibilityHint} onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: TOUCH_TARGET + 12, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  text: { flex: 1, gap: 2 },
  pressed: { opacity: 0.7 },
});

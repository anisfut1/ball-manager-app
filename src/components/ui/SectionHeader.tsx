import { StyleSheet, View } from "react-native";
import type { ReactNode } from "react";
import { spacing } from "@/design";
import { AppText } from "./AppText";

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.row}>
      <AppText variant="eyebrow" tone="subtle" accessibilityRole="header">
        {title}
      </AppText>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: spacing.sm } });

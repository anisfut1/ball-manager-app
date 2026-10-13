import { StyleSheet, View } from "react-native";
import type { ReactNode } from "react";
import { AppText } from "@/components/ui";
import { colors, spacing } from "@/design";
import type { DayGroup } from "./match-model";

/** Un en-tête de date par jour, puis les éléments de ce jour (comme sur le web). */
export function DayGroups<T>({ groups, render, itemKey, unit = "matchs" }: { groups: DayGroup<T>[]; render: (item: T) => ReactNode; itemKey: (item: T) => string; unit?: string }) {
  return (
    <View style={styles.list}>
      {groups.map((g) => (
        <View key={g.key} style={styles.group}>
          <View style={styles.header}>
            <AppText variant="headline">{g.label}</AppText>
            {g.items.length > 1 ? (
              <AppText variant="meta" tone="subtle">
                {g.items.length} {unit}
              </AppText>
            ) : null}
          </View>
          {g.items.map((item) => (
            <View key={itemKey(item)}>{render(item)}</View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xxl },
  group: { gap: spacing.md },
  header: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, paddingBottom: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});

import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, shadows, spacing } from "@/design";
import { AppText } from "./AppText";

/** Onglets internes d'un écran (ex. Vue d'ensemble / Planning / Effectif). */
export function SegmentedControl<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(o.value)} style={[styles.item, selected && styles.selected]}>
            <AppText variant="callout" tone={selected ? "default" : "muted"} style={selected ? styles.strong : null} numberOfLines={1}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 3 },
  item: { flex: 1, minHeight: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, paddingHorizontal: spacing.sm },
  selected: { backgroundColor: colors.surfaceRaised, ...shadows.card },
  strong: { fontWeight: "600" },
});

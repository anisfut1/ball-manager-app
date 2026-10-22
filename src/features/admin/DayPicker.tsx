import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui";
import { colors, radius, spacing, TOUCH_TARGET } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { dayKeyParts, monthGrid, monthTitle } from "./dates";

/**
 * Choix d'un jour (« AAAA-MM-JJ ») dans un mini calendrier mensuel, sans
 * dépendance native. Les jours avant `min` sont grisés.
 */
export function DayPicker({ value, min, onChange }: { value: string | null; min: string; onChange: (day: string) => void }) {
  const start = dayKeyParts(value ?? min);
  const [shown, setShown] = useState({ year: start.year, month: start.month });
  const accent = useClubAccent();
  const weeks = monthGrid(shown.year, shown.month);
  const shift = (delta: number) => setShown(({ year, month }) => {
    const index = year * 12 + (month - 1) + delta;
    return { year: Math.floor(index / 12), month: (index % 12) + 1 };
  });

  return (
    <View style={styles.box}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" accessibilityLabel="Mois précédent" onPress={() => shift(-1)} style={styles.navButton} hitSlop={6}>
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <AppText variant="bodyStrong">{monthTitle(shown.year, shown.month)}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Mois suivant" onPress={() => shift(1)} style={styles.navButton} hitSlop={6}>
          <Ionicons name="chevron-forward" size={20} color={colors.foreground} />
        </Pressable>
      </View>
      <View style={styles.row}>
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <AppText key={i} variant="meta" tone="muted" style={styles.cellText}>
            {d}
          </AppText>
        ))}
      </View>
      {weeks.map((week, w) => (
        <View key={w} style={styles.row}>
          {week.map((day, i) => {
            if (!day) return <View key={i} style={styles.cell} />;
            const disabled = day < min;
            const selected = day === value;
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                accessibilityLabel={day}
                disabled={disabled}
                onPress={() => onChange(day)}
                style={[styles.cell, selected && { backgroundColor: accent.accent }]}
              >
                <AppText variant="callout" color={selected ? accent.ink : undefined} tone={disabled ? "subtle" : "default"} style={styles.cellText}>
                  {String(dayKeyParts(day).day)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.xs },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navButton: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row" },
  cell: { flex: 1, aspectRatio: 1, maxHeight: TOUCH_TARGET, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  cellText: { textAlign: "center", flex: 1 },
});

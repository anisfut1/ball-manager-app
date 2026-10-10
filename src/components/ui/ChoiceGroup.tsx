import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, radius, spacing, TOUCH_TARGET } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { AppText } from "./AppText";

export interface Choice<T extends string> {
  value: T;
  label: string;
  tone?: "positive" | "negative" | "neutral";
}

/**
 * Réponse en un geste (Présent / Absent / Incertain, Disponible…, Je confirme…).
 * Boutons ≥ 44 pt, état sélectionné annoncé à VoiceOver.
 */
export function ChoiceGroup<T extends string>({ choices, value, onChange, disabled, accessibilityLabel }: { choices: Choice<T>[]; value: T | null; onChange: (value: T) => void; disabled?: boolean; accessibilityLabel: string }) {
  const accent = useClubAccent();
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {choices.map((c) => {
        const selected = c.value === value;
        const tint = c.tone === "positive" ? colors.success : c.tone === "negative" ? colors.danger : accent.text;
        return (
          <Pressable
            key={c.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: !!disabled }}
            accessibilityLabel={c.label}
            disabled={disabled}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              onChange(c.value);
            }}
            style={({ pressed }) => [
              styles.choice,
              selected ? { backgroundColor: tint, borderColor: tint } : null,
              { opacity: disabled ? 0.55 : pressed ? 0.8 : 1 },
            ]}
          >
            <AppText variant="bodyStrong" color={selected ? "#FFFFFF" : colors.foreground} numberOfLines={1} adjustsFontSizeToFit>
              {c.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  choice: { flex: 1, minHeight: TOUCH_TARGET, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm },
});

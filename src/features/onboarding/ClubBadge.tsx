import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { AppText, initials } from "@/components/ui";
import { colors } from "@/design";
import { deriveClubAccent } from "@/design/accent";

/** Logo du club (ou ses initiales sur sa couleur) : le club se reconnaît d'un coup d'œil. */
export function ClubBadge({ name, logoUrl, accentColor, size = 48 }: { name: string; logoUrl: string | null; accentColor?: string | null; size?: number }) {
  const accent = deriveClubAccent(accentColor ?? null);
  const box = { width: size, height: size, borderRadius: size * 0.28 };
  if (logoUrl) {
    return (
      <View style={[styles.frame, box]}>
        <Image source={{ uri: logoUrl }} style={styles.fill} contentFit="contain" accessibilityIgnoresInvertColors />
      </View>
    );
  }
  const words = name.replace(/^(SC|AS|US|BC|CB|ES|AL)\s+/i, "").split(/\s+/);
  return (
    <View style={[styles.monogram, box, { backgroundColor: accent.accent }]} accessibilityElementsHidden>
      <AppText variant="headline" color={accent.ink} style={{ fontSize: size * 0.36, lineHeight: size * 0.44 }}>
        {initials(words[0] ?? name, words[1] ?? null)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 4, overflow: "hidden" },
  fill: { flex: 1 },
  monogram: { alignItems: "center", justifyContent: "center" },
});

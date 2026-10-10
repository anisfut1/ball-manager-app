import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { colors } from "@/design";
import { AppText } from "./AppText";

export function initials(firstName: string, lastName?: string | null): string {
  const a = firstName.trim().charAt(0);
  const b = (lastName ?? "").trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

export function Avatar({ firstName, lastName, photoUrl, size = 36 }: { firstName: string; lastName?: string | null; photoUrl?: string | null; size?: number }) {
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (photoUrl) return <Image source={{ uri: photoUrl }} style={[styles.base, style]} accessibilityIgnoresInvertColors contentFit="cover" />;
  return (
    <View style={[styles.base, styles.fallback, style]} accessibilityElementsHidden>
      <AppText variant="meta" tone="muted" style={styles.letters}>
        {initials(firstName, lastName)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surfaceMuted },
  fallback: { alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  letters: { fontWeight: "700" },
});

import { useEffect, useState } from "react";
import { Animated, StyleSheet, View, type DimensionValue } from "react-native";
import { colors, radius, spacing } from "@/design";

export function Skeleton({ height = 16, width = "100%" }: { height?: number; width?: DimensionValue }) {
  const [opacity] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.block, { height, width, opacity }]} />;
}

/** Cartes fantômes pendant le premier chargement. */
export function CardSkeletons({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.list} accessibilityLabel="Chargement" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.card}>
          <Skeleton width="40%" height={12} />
          <Skeleton width="80%" height={18} />
          <Skeleton height={44} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm },
  list: { gap: spacing.lg },
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});

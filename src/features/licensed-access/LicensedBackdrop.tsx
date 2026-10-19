import { useEffect, useState, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useClubAccent } from "@/design/ClubTheme";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Flottement lent (quelques points, quelques secondes) sur le fil natif.
 * Figé si l'utilisateur réduit les animations.
 */
export function Floating({ children, amplitude = 6, duration = 3200, delay = 0, style }: { children: ReactNode; amplitude?: number; duration?: number; delay?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) {
      progress.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(progress, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, progress, duration, delay]);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -amplitude] });
  return <Animated.View style={[style, { transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/**
 * Ambiance du fond : nacre teintée par l'accent du club, halos diffus et
 * deux orbes. Purement décoratif, invisible pour VoiceOver.
 */
export function LicensedBackdrop() {
  const accent = useClubAccent();
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { experimental_backgroundImage: `linear-gradient(180deg, ${accent.soft} 0%, #F7F6F2 38%, #F4F3EF 100%)` }]} />
      <View style={[styles.halo, styles.haloTop, { boxShadow: `0 0 180px 60px ${accent.accent}17` }]} />
      <View style={[styles.halo, styles.haloBottom, { boxShadow: "0 0 180px 50px rgba(233,201,138,0.18)" }]} />
      <Floating duration={4200} style={styles.orbTop}>
        <View style={[styles.orb, { width: 56, height: 56, borderRadius: 28, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.9), 0 12px 28px -14px ${accent.accent}66`, experimental_backgroundImage: `radial-gradient(circle at 32% 28%, #FFFFFF 0%, ${accent.soft} 70%)` }]} />
      </Floating>
      <Floating duration={5200} delay={900} style={styles.orbSide}>
        <View style={[styles.orb, { width: 22, height: 22, borderRadius: 11, backgroundColor: accent.soft, boxShadow: `0 0 14px ${accent.accent}40` }]} />
      </Floating>
    </View>
  );
}

const styles = StyleSheet.create({
  halo: { position: "absolute", width: 10, height: 10, borderRadius: 5 },
  haloTop: { top: 90, left: "30%" },
  haloBottom: { bottom: 120, right: "10%" },
  orbTop: { position: "absolute", top: 64, right: -14 },
  orbSide: { position: "absolute", top: 230, left: 10 },
  orb: { opacity: 0.85 },
});

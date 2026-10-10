import type { TextStyle } from "react-native";

/**
 * Police système (SF Pro sur iOS) : Dynamic Type respecté par défaut
 * (`allowFontScaling`), plafonné dans AppText pour ne pas casser les cartes.
 */
export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: -0.4 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: -0.3 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600", letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400" },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  callout: { fontSize: 15, lineHeight: 20, fontWeight: "400" },
  meta: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" },
  numeric: { fontSize: 22, lineHeight: 26, fontWeight: "700", fontVariant: ["tabular-nums"] },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

/** Plafond de Dynamic Type (texte agrandi lisible sans casser la mise en page). */
export const MAX_FONT_SCALE = 1.6;

import type { ViewStyle } from "react-native";

/** Ombres diffuses et courtes (jamais de gros halo). iOS : shadow* ; Android : elevation. */
export const shadows = {
  none: {},
  card: { shadowColor: "#17171A", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  raised: { shadowColor: "#17171A", shadowOpacity: 0.1, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 4 },
} satisfies Record<string, ViewStyle>;

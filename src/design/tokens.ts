/**
 * Tokens Ball Manager (mobile) — même langage que ball-manager-web
 * (src/app/globals.css) : fond ivoire froid, texte graphite, filets fins,
 * profondeur discrète. Light mode uniquement en V1.
 */
export const colors = {
  background: "#F4F3EF",
  surface: "#FBFAF8",
  surfaceRaised: "#FFFFFF",
  surfaceMuted: "#ECEAE4",
  surfaceSunken: "#E9E7E0",
  foreground: "#17171A",
  muted: "#5E5D57",
  subtle: "#807E76",
  border: "rgba(23,23,26,0.08)",
  borderStrong: "rgba(23,23,26,0.14)",
  hairlineHighlight: "rgba(255,255,255,0.9)",
  success: "#0F7A4F",
  successSoft: "#E7F2EC",
  warning: "#A15C07",
  warningSoft: "#F6EEE3",
  danger: "#C2331F",
  dangerSoft: "#F9EAE7",
  info: "#2563A8",
  infoSoft: "#E9EFF6",
  overlay: "rgba(23,23,26,0.32)",
} as const;

export type ColorToken = keyof typeof colors;

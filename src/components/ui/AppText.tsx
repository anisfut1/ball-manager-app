import { Text, type TextProps } from "react-native";
import { colors, MAX_FONT_SCALE, typography, type TypographyVariant } from "@/design";

export type TextTone = "default" | "muted" | "subtle" | "accent" | "success" | "warning" | "danger" | "inverse";

const TONES: Record<Exclude<TextTone, "accent">, string> = {
  default: colors.foreground,
  muted: colors.muted,
  subtle: colors.subtle,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  inverse: "#FFFFFF",
};

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  tone?: TextTone;
  /** Couleur explicite (ex. texte d'accent du club) — prioritaire sur `tone`. */
  color?: string;
}

/** Texte unique de l'app : typographie et Dynamic Type plafonné au même endroit. */
export function AppText({ variant = "body", tone = "default", color, style, maxFontSizeMultiplier = MAX_FONT_SCALE, ...props }: AppTextProps) {
  const toneColor = color ?? (tone === "accent" ? undefined : TONES[tone]);
  return <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[typography[variant], toneColor ? { color: toneColor } : null, style]} {...props} />;
}

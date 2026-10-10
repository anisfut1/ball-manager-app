/**
 * Couleur du club (`club.accentColor`) → trois teintes utilisables.
 * Même règle que ball-manager-web (src/lib/ui/accent.ts) : la couleur reste
 * celle du club, le texte est assombri jusqu'à un contraste ≥ 4.5:1.
 */
export const FALLBACK_ACCENT = "#2F5BFF";

const DARKEST_LIGHT_SURFACE = "#ECEAE4";
const INK_DARK = "#17171A";
const INK_LIGHT = "#FFFFFF";

type Rgb = [number, number, number];

function parseHex(value: string | null | undefined): Rgb | null {
  if (!value) return null;
  const hex = value.trim().replace(/^#/, "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(parseHex(a) ?? [0, 0, 0]);
  const lb = luminance(parseHex(b) ?? [0, 0, 0]);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface ClubAccent {
  accent: string;
  ink: string;
  text: string;
  soft: string;
}

/** Mélange linéaire vers une couleur (suffisant pour un fond « soft »). */
function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  return [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount, a[2] + (b[2] - a[2]) * amount];
}

export function deriveClubAccent(color: string | null | undefined): ClubAccent {
  const rgb = parseHex(color) ?? (parseHex(FALLBACK_ACCENT) as Rgb);
  const accent = toHex(rgb);
  const ink = contrastRatio(INK_LIGHT, accent) >= contrastRatio(INK_DARK, accent) ? INK_LIGHT : INK_DARK;
  let text = accent;
  for (let step = 1; step <= 20 && contrastRatio(text, DARKEST_LIGHT_SURFACE) < 4.5; step += 1) {
    text = toHex(mix(rgb, [0, 0, 0], step * 0.05));
  }
  const soft = toHex(mix(rgb, [255, 255, 255], 0.9));
  return { accent, ink, text, soft };
}

import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { MatchListItem } from "@/api/endpoints/clubSpace";
import { AppText, Badge } from "@/components/ui";
import { colors, radius, shadows, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { ClubBadge } from "@/features/onboarding/ClubBadge";
import { competitionLine, isPlayed, matchOutcome, matchSides, matchStatusLabel, matchTime, type MatchSide } from "./match-model";

/**
 * Carte match signature (même logique que la MatchCard du web) : à venir,
 * l'HEURE domine ; joué, le SCORE domine (vainqueur en gras, perdant
 * atténué). Logos réels, monogramme en repli. Rien d'inventé : un champ
 * absent s'affiche « à confirmer ».
 */
export function MatchCard({ match, club, onPress }: { match: MatchListItem; club: { name: string; logoUrl: string | null; accentColor?: string | null }; onPress?: () => void }) {
  const accent = useClubAccent();
  const played = isPlayed(match);
  const [home, away] = matchSides(match, club);
  const outcome = matchOutcome(match);
  const status = matchStatusLabel(match.status);
  const time = matchTime(match);
  const emphasis = (s: MatchSide): "win" | "lose" | "neutral" => {
    if (!played || home.score === away.score) return "neutral";
    const other = s === home ? away : home;
    return (s.score ?? 0) > (other.score ?? 0) ? "win" : "lose";
  };
  const label = `${home.name} contre ${away.name}${time ? ` à ${time}` : ""}${played ? `, score ${home.score} à ${away.score}` : ""}`;

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.top}>
        <AppText variant="eyebrow" tone="subtle" numberOfLines={1} style={styles.flex}>
          {competitionLine(match)}
        </AppText>
        {!played ? (
          <AppText variant="numeric" color={accent.text} style={styles.time}>
            {time ?? "--:--"}
          </AppText>
        ) : null}
      </View>
      {[home, away].map((side) => (
        <View key={side.isClub ? "club" : "opp"} style={styles.line}>
          <ClubBadge name={side.logoName} logoUrl={side.logoUrl} accentColor={side.isClub ? club.accentColor : "#807E76"} size={30} />
          <AppText variant={emphasis(side) === "lose" ? "body" : "bodyStrong"} tone={emphasis(side) === "lose" ? "muted" : "default"} numberOfLines={2} style={styles.flex}>
            {side.name}
          </AppText>
          {played ? (
            <AppText variant="numeric" tone={emphasis(side) === "win" ? "default" : "muted"}>
              {side.score}
            </AppText>
          ) : null}
        </View>
      ))}
      <View style={styles.footer}>
        {match.isHome !== null ? (
          <View style={styles.meta}>
            <Ionicons name={match.isHome ? "home-outline" : "car-outline"} size={14} color={colors.subtle} />
            <AppText variant="meta" tone="muted">
              {match.isHome ? "Domicile" : "Extérieur"}
            </AppText>
          </View>
        ) : null}
        {match.venueLabel ? (
          <View style={[styles.meta, styles.flex]}>
            <Ionicons name="location-outline" size={14} color={colors.subtle} />
            <AppText variant="meta" tone="muted" numberOfLines={1} style={styles.flex}>
              {match.venueLabel}
            </AppText>
          </View>
        ) : null}
        {status ? <Badge tone={status.tone} label={status.label} /> : null}
        {played && outcome ? <Badge tone={outcome === "win" ? "success" : "neutral"} label={outcome === "win" ? "Victoire" : outcome === "loss" ? "Défaite" : "Nul"} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceRaised, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: spacing.lg, gap: spacing.md, ...shadows.card },
  pressed: { opacity: 0.85 },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  time: { fontSize: 20 },
  line: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  footer: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.md },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  flex: { flex: 1 },
});

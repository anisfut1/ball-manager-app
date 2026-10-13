import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { MatchDetailsDto } from "@/api/endpoints/teamLife";
import { AppText, Badge } from "@/components/ui";
import { colors, radius, shadows, spacing } from "@/design";
import { ClubBadge } from "@/features/onboarding/ClubBadge";
import { journeeLabel, MATCH_TZ, matchOutcome, matchStatusLabel } from "../match-model";
import { formatLongDay, formatTime } from "@/lib/dates";

export interface ScoreboardTeam {
  name: string;
  logoName: string;
  logoUrl: string | null;
  isClub: boolean;
  accentColor?: string | null;
}

function TeamColumn({ team, sideLabel, dim }: { team: ScoreboardTeam; sideLabel: string; dim: boolean }) {
  return (
    <View style={styles.team}>
      <ClubBadge name={team.logoName} logoUrl={team.logoUrl} accentColor={team.isClub ? team.accentColor : "#807E76"} size={56} />
      <AppText variant="eyebrow" tone="subtle">
        {sideLabel}
      </AppText>
      <AppText variant="bodyStrong" tone={dim ? "muted" : "default"} numberOfLines={3} style={styles.center}>
        {team.name}
      </AppText>
    </View>
  );
}

/** Tableau de marque de la fiche match (comme le web) : score dominant si joué, heure sinon. */
export function Scoreboard({ match, home, away }: { match: MatchDetailsDto; home: ScoreboardTeam; away: ScoreboardTeam }) {
  const played = match.scoreHome !== null && match.scoreAway !== null;
  const status = matchStatusLabel(match.status);
  const outcome = matchOutcome(match);
  const homeWon = played && (match.scoreHome ?? 0) > (match.scoreAway ?? 0);
  const awayWon = played && (match.scoreAway ?? 0) > (match.scoreHome ?? 0);
  const time = match.matchDatetime ? formatTime(match.matchDatetime, MATCH_TZ) : null;
  const longDate = match.matchDatetime ? formatLongDay(match.matchDatetime, MATCH_TZ) : null;
  return (
    <View style={styles.card} accessibilityLabel="Tableau de marque">
      <View style={styles.top}>
        <AppText variant="eyebrow" tone="subtle" numberOfLines={2} style={styles.flex}>
          {[match.competitionName, journeeLabel(match.journee), match.numero ? `Rencontre n° ${match.numero}` : null].filter(Boolean).join(" · ") || "Rencontre"}
        </AppText>
      </View>
      <View style={styles.badges}>
        {match.isHome !== null ? <Badge tone={match.isHome ? "info" : "neutral"} label={match.isHome ? "Domicile" : "Extérieur"} /> : null}
        {status ? <Badge tone={status.tone} label={status.label} /> : null}
        {played && outcome ? <Badge tone={outcome === "win" ? "success" : "neutral"} label={outcome === "win" ? "Victoire" : outcome === "loss" ? "Défaite" : "Nul"} /> : null}
      </View>
      <View style={styles.main}>
        <TeamColumn team={home} sideLabel="Domicile" dim={awayWon} />
        <View style={styles.score}>
          {played ? (
            <AppText variant="numeric" style={styles.big}>
              <AppText variant="numeric" style={styles.big} tone={homeWon || !awayWon ? "default" : "muted"}>
                {match.scoreHome}
              </AppText>
              <AppText variant="numeric" style={styles.dash} tone="subtle">
                {" – "}
              </AppText>
              <AppText variant="numeric" style={styles.big} tone={awayWon || !homeWon ? "default" : "muted"}>
                {match.scoreAway}
              </AppText>
            </AppText>
          ) : (
            <AppText variant="numeric" style={styles.big}>
              {time ?? "--:--"}
            </AppText>
          )}
          <AppText variant="eyebrow" tone="subtle">
            {played ? "Score final" : time ? "Coup d'envoi" : "Horaire à confirmer"}
          </AppText>
        </View>
        <TeamColumn team={away} sideLabel="Extérieur" dim={homeWon} />
      </View>
      <View style={styles.footer}>
        <View style={styles.meta}>
          <Ionicons name="calendar-outline" size={15} color={colors.subtle} />
          <AppText variant="meta" tone="muted">
            {longDate ? longDate.charAt(0).toUpperCase() + longDate.slice(1) : "Date à confirmer"}
          </AppText>
        </View>
        {time ? (
          <View style={styles.meta}>
            <Ionicons name="time-outline" size={15} color={colors.subtle} />
            <AppText variant="meta" tone="muted">
              {time}
            </AppText>
          </View>
        ) : null}
        <View style={styles.meta}>
          <Ionicons name="location-outline" size={15} color={colors.subtle} />
          <AppText variant="meta" tone="muted" numberOfLines={2} style={styles.flex}>
            {match.venueLabel ?? "Lieu à confirmer"}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceRaised, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden", ...shadows.card },
  top: { flexDirection: "row", paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  main: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xxl },
  team: { flex: 1, alignItems: "center", gap: spacing.xs },
  center: { textAlign: "center" },
  score: { alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.xs },
  big: { fontSize: 38, lineHeight: 44, fontWeight: "600" },
  dash: { fontSize: 26 },
  footer: { gap: spacing.xs, padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
});

import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DerogationMatchRef, DerogationStatus, DerogationSummary } from "@/api/endpoints/derogations";
import { AppText, Badge } from "@/components/ui";
import { colors, radius, shadows, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { formatRelative, formatShortDateTime, STATUS_META, teamLabel } from "./labels";

export function RequestStatusBadge({ status }: { status: DerogationStatus }) {
  const meta = STATUS_META[status];
  return <Badge tone={meta.tone} label={meta.label} />;
}

export function TeamChip({ label }: { label: string }) {
  const accent = useClubAccent();
  return (
    <View style={[styles.chip, { backgroundColor: accent.soft }]}>
      <AppText variant="meta" color={accent.text} style={styles.bold}>
        {label}
      </AppText>
    </View>
  );
}

export function HomeAwayTag({ isHome }: { isHome: boolean | null }) {
  if (isHome === null) return null;
  return (
    <View style={styles.inline}>
      <Ionicons name={isHome ? "home-outline" : "airplane-outline"} size={13} color={colors.muted} />
      <AppText variant="meta" tone="muted">
        {isHome ? "Domicile" : "Extérieur"}
      </AppText>
    </View>
  );
}

/** « U15F · vs Montpellier » + date actuelle (fuseau du club). */
export function MatchHeadline({ match, timezone, trailing }: { match: DerogationMatchRef; timezone: string; trailing?: React.ReactNode }) {
  return (
    <View style={styles.headline}>
      <View style={styles.wrap}>
        <TeamChip label={teamLabel(match)} />
        <AppText variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
          {match.opponentName ? `vs ${match.opponentName}` : "Adversaire à confirmer"}
        </AppText>
        {trailing}
      </View>
      <View style={styles.wrap}>
        <AppText variant="meta" tone="muted">
          {formatShortDateTime(match.matchDatetime, timezone)}
        </AppText>
        <HomeAwayTag isHome={match.isHome} />
        {match.venueName ? (
          <AppText variant="meta" tone="muted" numberOfLines={1} style={styles.shrink}>
            {match.venueName}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/** Carte d'une demande (liste) — comme le web : date barrée → nouvelle date, gymnase, demandeur, dernier message. */
export function RequestCard({ request: r, manager, timezone, now, onPress }: { request: DerogationSummary; manager: boolean; timezone: string; now: Date; onPress: () => void }) {
  const accent = useClubAccent();
  const attention = manager ? r.needsCoordinatorAttention : r.status === "NEEDS_CHANGE";
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {attention ? <View style={[styles.attention, { backgroundColor: accent.accent }]} /> : null}
      <View style={styles.top}>
        <View style={[styles.wrap, styles.shrink]}>
          <TeamChip label={teamLabel(r.match)} />
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
            {r.match.opponentName ? `vs ${r.match.opponentName}` : "Adversaire à confirmer"}
          </AppText>
        </View>
        <RequestStatusBadge status={r.status} />
      </View>
      <View style={styles.wrap}>
        <AppText variant="callout" tone="muted" style={styles.strike}>
          {formatShortDateTime(r.originalScheduledAt, timezone)}
        </AppText>
        <Ionicons name="arrow-forward" size={14} color={colors.subtle} accessibilityLabel="vers" />
        <AppText variant="callout" style={styles.bold}>
          {formatShortDateTime(r.requestedStartAt, timezone)}
        </AppText>
      </View>
      <View style={styles.wrap}>
        <View style={styles.inline}>
          <Ionicons name="location-outline" size={13} color={colors.muted} />
          <AppText variant="meta" tone="muted">
            {r.requestedVenue?.name ?? "Extérieur"}
          </AppText>
        </View>
        {manager ? (
          <View style={styles.inline}>
            <Ionicons name="person-outline" size={13} color={colors.muted} />
            <AppText variant="meta" tone="muted">
              {r.requesterDisplayName}
            </AppText>
          </View>
        ) : null}
        {r.isCustomWeekday ? (
          <View style={styles.inline}>
            <Ionicons name="calendar-outline" size={13} color={colors.muted} />
            <AppText variant="meta" tone="muted">
              En semaine
            </AppText>
          </View>
        ) : null}
      </View>
      {r.lastMessage ? (
        <View style={styles.last}>
          <Ionicons name="chatbubble-outline" size={13} color={colors.subtle} />
          <AppText variant="meta" tone="muted" numberOfLines={1} style={styles.shrink}>
            {`${r.lastMessage.type === "USER" ? `${r.lastMessage.authorDisplayName} : ` : ""}${r.lastMessage.excerpt}`}
          </AppText>
          <AppText variant="meta" tone="subtle">
            {formatRelative(r.lastMessageAt, now, timezone)}
          </AppText>
          <Ionicons name="chevron-forward" size={15} color={colors.subtle} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { height: 24, paddingHorizontal: spacing.sm, borderRadius: 6, justifyContent: "center" },
  bold: { fontWeight: "600" },
  inline: { flexDirection: "row", alignItems: "center", gap: 4 },
  headline: { gap: 4 },
  wrap: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  shrink: { flexShrink: 1 },
  card: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surfaceRaised, overflow: "hidden", ...shadows.card },
  pressed: { opacity: 0.85 },
  attention: { position: "absolute", left: 0, top: spacing.lg, width: 3, height: 32, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  top: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  strike: { textDecorationLine: "line-through" },
  last: { flexDirection: "row", alignItems: "center", gap: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm },
});

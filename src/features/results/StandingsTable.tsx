import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PoolStandingsDto } from "@/api/endpoints/clubSpace";
import { AppText } from "@/components/ui";
import { colors, radius, shadows, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { ClubBadge } from "@/features/onboarding/ClubBadge";

const n = (v: number | null) => (v === null ? "—" : String(v));
const signed = (v: number | null) => (v === null ? "—" : v > 0 ? `+${v}` : String(v));

/** Classement FFBB d'une poule, comme le web : valeurs publiées par la FFBB (jamais recalculées), ligne du club mise en avant. */
export function StandingsTable({ pool, clubLogoUrl }: { pool: PoolStandingsDto; clubLogoUrl: string | null }) {
  const accent = useClubAccent();
  const updatedAt = pool.updatedAt ? new Date(pool.updatedAt).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long" }) : null;
  return (
    <View style={styles.card} accessibilityLabel={`Classement ${pool.poolName}`}>
      <View style={styles.header}>
        <Ionicons name="podium-outline" size={18} color={accent.text} />
        <View style={styles.flex}>
          <AppText variant="headline">Classement · {pool.poolName}</AppText>
          {pool.competitionName ? (
            <AppText variant="meta" tone="muted">
              {pool.competitionName}
            </AppText>
          ) : null}
        </View>
      </View>
      <View style={[styles.row, styles.head]}>
        <AppText variant="eyebrow" tone="subtle" style={styles.pos}>
          #
        </AppText>
        <AppText variant="eyebrow" tone="subtle" style={styles.flex}>
          Équipe
        </AppText>
        {["Pts", "J", "G", "P", "+/-"].map((h) => (
          <AppText key={h} variant="eyebrow" tone="subtle" style={h === "+/-" ? styles.diff : styles.num}>
            {h}
          </AppText>
        ))}
      </View>
      {pool.rows.map((row, i) => (
        <View key={`${row.teamName}-${i}`} style={[styles.row, i > 0 && styles.sep, row.isClub && { backgroundColor: accent.soft }]}>
          <AppText variant="callout" style={[styles.pos, row.isClub && { color: accent.text, fontWeight: "700" }]}>
            {row.outOfRanking ? "HC" : n(row.position)}
          </AppText>
          <View style={[styles.flex, styles.team]}>
            <ClubBadge name={row.teamName} logoUrl={row.isClub ? (clubLogoUrl ?? row.logoUrl) : row.logoUrl} accentColor={row.isClub ? undefined : "#807E76"} size={22} />
            <AppText variant={row.isClub ? "bodyStrong" : "callout"} numberOfLines={2} style={styles.flex}>
              {row.teamName}
            </AppText>
          </View>
          <AppText variant="bodyStrong" style={styles.num}>
            {n(row.points)}
          </AppText>
          <AppText variant="callout" tone="muted" style={styles.num}>
            {n(row.played)}
          </AppText>
          <AppText variant="callout" tone="muted" style={styles.num}>
            {n(row.won)}
          </AppText>
          <AppText variant="callout" tone="muted" style={styles.num}>
            {n(row.lost)}
          </AppText>
          <AppText variant="callout" tone="muted" style={styles.diff}>
            {signed(row.difference)}
          </AppText>
        </View>
      ))}
      <AppText variant="meta" tone="subtle" style={styles.footer}>
        Classement FFBB{updatedAt ? ` · mis à jour le ${updatedAt}` : ""}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceRaised, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden", ...shadows.card },
  header: { flexDirection: "row", gap: spacing.sm, padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  head: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pos: { width: 26, textAlign: "center", fontVariant: ["tabular-nums"] },
  team: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  num: { width: 28, textAlign: "right", fontVariant: ["tabular-nums"] },
  diff: { width: 38, textAlign: "right", fontVariant: ["tabular-nums"] },
  footer: { padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
